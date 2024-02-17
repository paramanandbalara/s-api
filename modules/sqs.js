"use strict";
const AWS = require("aws-sdk");
AWS.config.update({ region: process.env.sqsregion })
const SQS = new AWS.SQS({
    apiVersion: process.env.sqsapiVersion,
    credentials: new AWS.SharedIniFileCredentials({ profile: "sx-sqs" }),
});

const sendMessage = async (QUEUE_URL, message) => {
    return new Promise((resolve, reject) => {
        try {
            const params = {
                MessageBody: JSON.stringify(message),
                QueueUrl: QUEUE_URL,
            };
            SQS.sendMessage(params, function (error, data) {
                if (error) {
                    resolve({
                        success: false,
                        message: error,
                    });
                } else {
                    resolve({
                        success: true,
                        message: "Order pushed successfully",
                        data: data,
                    });
                }
            });
        } catch (error) {
            resolve({
                success: false,
                message: error.message || "Unable to process your request",
            });
        }
    });
};

const receiveMessage = async (QUEUE_URL) => {
    const params = {
        AttributeNames: ["SentTimestamp"],
        MaxNumberOfMessages: 10,
        MessageAttributeNames: ["All"],
        QueueUrl: QUEUE_URL,
        VisibilityTimeout: 20,
        WaitTimeSeconds: 20,
    };

    try {
        const result = await SQS.receiveMessage(params).promise();
        return result || [];
    } catch (error) {
        console.log("Unable to fetch order from SQS: ", error);
        throw error;
    }
};

const deleteMessage = async (QUEUE_URL, deleteData) => {
    return new Promise((resolve, reject) => {
        const deleteParams = {
            QueueUrl: QUEUE_URL,
            ReceiptHandle: deleteData,
        };
        SQS.deleteMessage(deleteParams, (error, result) => {
            if (error) resolve(false);
            else resolve(true);
        });
    });
};

module.exports = {
    sendMessage: sendMessage,
    receiveMessage: receiveMessage,
    deleteMessage: deleteMessage,
};