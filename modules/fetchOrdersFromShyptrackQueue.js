"use strict";

const { receiveMessage, deleteMessage } = require("./sqs");
const { savedeliveryOrder } = require('./orderDelivery')
const SQS_JSON = require('../../shyptrack-static/sqs.json')

const QUEUE_URL =
    process.env.NODE_ENV === "production"
        ? SQS_JSON.production["shyptrack-orders-sns"]
        : SQS_JSON.staging["shyptrack-orders-sns"] || null;

const fetchOrdersFromSns = async () => {
    try {
        console.log(__line, 'fetchOrdersFromSns')
        if (!QUEUE_URL) {
            return
        }
        const queueData = await receiveMessage(QUEUE_URL);
        if (!queueData?.Messages?.length) {
            console.info("No data in queue ---> sns....");
            return;
        }
        const { Messages: messages } = queueData;

        console.info(__line, messages.length);

        // Process messages in parallel
        const promises = messages.map((message) => {
            let orders = JSON.parse(message.Body);
            orders = JSON.parse(orders.Message)
            return processOrders(orders, message.ReceiptHandle)
        });
        const result = await Promise.allSettled(promises);

        // Delete successful messages in parallel
        const successful = result.filter(res => res.status === 'fulfilled')
            .map(res => res.value);

        const deletionResults = await Promise.allSettled(successful.map((receiptHandle) => {
            return deleteMessage(QUEUE_URL, receiptHandle);
        }));

        console.info(__line, deletionResults);

    } catch (exception) {
        console.error(exception);
    } finally {
        console.info("fetchOrdersFromSns completed.");
        // Wait for the specified time and then call fetchOrdersFromSns again
        if (QUEUE_URL) {
            await new Promise(resolve => setImmediate(async () => await fetchOrdersFromSns()));
        }
    }
};


const processOrders = async (orders, ReceiptHandle) => {
    try {
        const { source } = orders;
        let result;
        switch (Number(source)) {
            case 1:
            case 2:
            case 3:
                // Save delivery order
                result = await savedeliveryOrder(orders);
                break;
            default:
                throw new Error(`Invalid source: ${source}`);
        }
        console.info(__line, result);
        // Throw error if result is falsy
        if (!result) {
            throw new Error("Unable to save order");
        }
        return ReceiptHandle;
    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message)
    }
};


module.exports = { fetchOrdersFromSns }
