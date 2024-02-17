const axios = require('axios')

const SQS_JSON = require('../../shyptrack-static/sqs.json')
const SHYPMAX_JSON = require('../../shyptrack-static/shypmax.json')
const { getHeaders } = require('./shypmaxConfig')

const { receiveMessage, deleteMessage, sendMessage } = require('../modules/sqs');
const SHYPTRACK_EVENT_QUEUE_URL = process.env.NODE_ENV === "production" ? SQS_JSON.production["shyptrack-event"] : SQS_JSON.staging["shyptrack-event"];

module.exports = {
    pushEventsToQueue: async (data) => {
        try {
            await sendMessage(SHYPTRACK_EVENT_QUEUE_URL, data)
        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception)
        }
    }
}

const readEventsFromQueue = async () => {
    console.log(__line, 'readEventsFromQueue')
    let dataReceivedInQueue = false;
    try {
        const QUEUE_RESPONSE = await receiveMessage(SHYPTRACK_EVENT_QUEUE_URL)
        if (!QUEUE_RESPONSE.hasOwnProperty('Messages') || !QUEUE_RESPONSE?.Messages?.length) {
            return;
        }

        console.log("Events in queue... ", QUEUE_RESPONSE.Messages.length)
        dataReceivedInQueue = true;

        for (const message of QUEUE_RESPONSE.Messages) {
            const body = JSON.parse(message.Body)
            const result = await sendEventsTOShypmax(body)
            if (result) {
                await deleteMessage(SHYPTRACK_EVENT_QUEUE_URL, message.ReceiptHandle)
            }
        }

    } catch (exception) {
        console.error(exception)
    } finally {
        await new Promise(resolve => setImmediate(async () => await readEventsFromQueue()))
    }
}


const sendEventsTOShypmax = async (body) => {
    try {
        const { TRACKING_URL } = SHYPMAX_JSON;
        const config = await getConfig(body)
        const res = await axios(config, TRACKING_URL)
        if (!res.data?.success) {
            throw new Error('Error while pushing event')
        }
        return true
    } catch (exception) {
        console.error(exception.message)
        throw new Error(exception.message)
    }
}


const getConfig = async (data) => {
    try {
        const { TRACKING_URL } = SHYPMAX_JSON;
        const headers = await getHeaders()
        let config = {
            method: 'POST',
            url: TRACKING_URL,
            headers: headers,
            data: { data }
        };

        return config;
    }
    catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

module.exports = { readEventsFromQueue };
