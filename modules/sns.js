'use strict';

// Require the AWS SDK
const AWS = require('aws-sdk');

// Configure the AWS SDK with the region from the environment variables
AWS.config.update({ region: process.env.snsregion });

// Create a new SNS object with the API version and credentials from the environment variables
const sns = new AWS.SNS({
    apiVersion: process.env.snsapiVersion,
    credentials: new AWS.SharedIniFileCredentials({ profile: 'sx-sqs' })
});

// Define a function to publish a message on an SNS topic
const publishOnSns = async (message, topicArn, messageAttributes = null) => {
    // Check if a topicArn has been provided
    if (!topicArn) {
        console.error('Please provide topicArn');
        throw new Error('Please provide topicArn');
    }

    try {
        // Publish the message on the specified topic with optional message attributes
        const params = {
            Message: JSON.stringify(message),
            MessageAttributes: messageAttributes,
            TopicArn: topicArn
        }
        
        const resp = await sns.publish(params).promise();
        return resp;
    } catch (err) {
        // If an error occurs, log it and rethrow the error
        console.error(`Error in publishing on sns topic ${topicArn} ${err}`);
        throw err;
    }
};

// Export the publishOnSns function for use in other modules
module.exports = {
    publishOnSns
};
