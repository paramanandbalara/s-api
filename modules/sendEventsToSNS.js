const SNS_JSON = require('../../shyptrack-static/sns.json')
const { publishOnSns } = require('./sns')
const shypmaxAttributes = ['shypmax_rto', 'shypmax_import', 'shypmax']

// Determine the topic ARN based on the NODE_ENV environment variable
const shyptrackTopicArn = process.env.NODE_ENV === "production"
    ? SNS_JSON.production["sns-shyptrack-events"]
    : SNS_JSON.staging["sns-shyptrack-events"];

const SNS_AUTH = process.env.NODE_ENV === "production"
    ? SNS_JSON.production["authorization"]
    : SNS_JSON.staging["authorization"];

const pushTrackingToSns = async (trackingEvents) => {
    try {
        const result = trackingEvents.reduce((acc, curr) => {
            const { awb, ...rest } = curr;
            if (!acc[awb]) {
                acc[awb] = [];
            }
            acc[awb].push(rest);
            return acc;
        }, {});

        const data = Object.entries(result).map(([awb, events]) => ({
            [awb]: events,
            source: events[0].source,
        }));

        await Promise.allSettled(data.map((item) => sendEventsToSNS(item)));

        return true;
    } catch (exception) {
        console.error(exception);
        throw new Error(exception)
    }
}

// Define a function to send events to an SNS topic
const sendEventsToSNS = async (message) => {
    try {
        const { source, ...eventData } = message; // Extract the source and event data from the message
        const stringValue = shypmaxAttributes.includes(source) ? 'shypmax' : source;
        const authorization = SNS_AUTH[stringValue];
        const data = {
            data: eventData,
            authorization,
            source
        }
        const attributes = {
            subscriber: { DataType: 'String', StringValue: stringValue }
        }
        // Call the publishOnSns function to send the message to the SNS topic
        await publishOnSns(data, shyptrackTopicArn, attributes)
    } catch (error) {
        console.error(`Error sending events to SNS: ${error}`);
        throw error; // re-throw the error to the caller
    }
}

module.exports = { pushTrackingToSns }
