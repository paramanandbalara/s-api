'use strict';

const AWS = require('aws-sdk');

AWS.config.update({ region: process.env.sqsregion });

const sqs = new AWS.SQS({
    apiVersion: process.env.sqsapiVersion,
    credentials: new AWS.SharedIniFileCredentials({ profile: 'sx-sqs' })
});


/**
 * @typedef {Object} defaultReadMessageRequestParams
 * @property {String} [QueueUrl=''] URL of the queue being consumed
 * @property {Number} [MaxNumberOfMessages=1] Max number of messages to be read in each poll cycle
 * @property {Number} [VisibilityTimeout=10]  Number of seconds the messages consumed will invisible to other consumers
 * @property {Number} [WaitTimeSeconds=20]   Number of seconds the queue is polled
 * @property {String[]} [AttributeNames=['All']]  List of attribute values to be returned
 * @property {String[]} [MessageAttributeNames=['All']] List  of message attribute values to be returned
 * */
const defaultReadMessageRequestParams = {
    QueueUrl: '',
    MaxNumberOfMessages: 1,
    VisibilityTimeout: 10,
    WaitTimeSeconds: 20,
    AttributeNames: ['All'],
    MessageAttributeNames: ['All']
};

/**
 * @class ConsumerManager
 * <br />This class is responsible for the following operations -
 * <ol>
 *   <li>Read messages from sqs queues as per the parameters passed in readMessageParams</li>
 *   <li>Maintain heartbeat for extending visibility timeout of the messages read</li>
 *   <li>Delete successfully processed messages from the queue</li>
 *   <li>Stopping the consumer gracefully</li>
 * </ol>
 */
class ConsumerManager {
    /**
     * @param {Function} consumer                                           Consumer function
     * @param {defaultReadMessageRequestParams} readMessageParams  Object to pass to SQS.readMessage method
     * @param {Object} resetVisibilityTimeoutOptions
     * @param {Number} resetVisibilityTimeoutOptions.resetTimeout           Heartbeat interval in ms
     * @param {Number} resetVisibilityTimeoutOptions.visibilityTimeoutExt   Time in ms by which to extend visibility timeout of
     * the message
     * @param {String} resetVisibilityTimeoutOptions.queueUrl               URL of the SQS queue
     */
    constructor(consumer, readMessageParams, resetVisibilityTimeoutOptions) {
        const { resetTimeout, visibilityTimeoutExt, queueUrl } = resetVisibilityTimeoutOptions;

        this.consumer = consumer;
        this.readMessageParams = { ...defaultReadMessageRequestParams, ...readMessageParams };
        this.resetTimeout = resetTimeout;
        this.visibilityTimeoutExt = visibilityTimeoutExt;
        this.queueUrl = queueUrl;
        this.consumerHeartbeatHandle = null;
        this.stopConsumer = false;
        this.consumerIsRunning = false;
    }

    iterateOrTerminate() {
        if (false === this.stopConsumer) {
            setImmediate(this.run.bind(this));
        } else {
            this.consumerIsRunning = false;
        }
    }

    async run() {
        this.consumerIsRunning = true;
        const response = await sqs.receiveMessage(this.readMessageParams).promise();

        if (!response?.Messages?.length) {
            this.iterateOrTerminate();
            return;
        }

        const receiptHandles = response?.Messages.map((msg) => msg.ReceiptHandle);

        this.consumerHeartbeatHandle = setInterval(
            this.consumerHeartbeat.bind(this), this.resetTimeout, receiptHandles
        );

        const visibilityTimeoutExt = this.visibilityTimeoutExt;

        try {
            const { processedReceiptHandles, failedReceiptHandles } = await this.consumer(response?.Messages);
            clearInterval(this.consumerHeartbeatHandle);
            this.visibilityTimeoutExt = 0;
            await Promise.allSettled([
                Promise.allSettled(processedReceiptHandles.map(this.deleteMessagesFromQueue.bind(this))),
                Promise.allSettled(failedReceiptHandles.map(this.changeSQSMessageVisibility.bind(this)))
            ]);
        } catch (err) {
            clearInterval(this.consumerHeartbeatHandle);
            this.visibilityTimeoutExt = 0;
            await Promise.allSettled(receiptHandles.map(this.changeSQSMessageVisibility.bind(this)));
        } finally {
            this.visibilityTimeoutExt = visibilityTimeoutExt;
            this.iterateOrTerminate();
        }
    }

    async changeSQSMessageVisibility(receiptHandle) {
        return sqs.changeMessageVisibility({
            QueueUrl: this.queueUrl,
            ReceiptHandle: receiptHandle,
            VisibilityTimeout: this.visibilityTimeoutExt
        }).promise();
    }

    async consumerHeartbeat(receiptHandles) {
        // TODO: handle failed requests
        await Promise.allSettled(
            receiptHandles.map(this.changeSQSMessageVisibility.bind(this))
        );
    }

    async deleteMessagesFromQueue(receiptHandle) {
        return sqs.deleteMessage({
            QueueUrl: this.queueUrl,
            ReceiptHandle: receiptHandle
        }
        ).promise();

    }

    async stop() {
        clearInterval(this.consumerHeartbeatHandle);
        this.stopConsumer = true;
        while (true === this.consumerIsRunning) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
}

module.exports = ConsumerManager;