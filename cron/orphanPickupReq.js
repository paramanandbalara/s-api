const express = require('express');
const app = express();
require('../bin/bootstrap')(app);

const PICKUP_REQUEST_MODEL = require('../models/pickup_request')
const ORDERS_MODEL = require('../models/orders')
const eligble_status_for_assign = [1, 3, 4, 17, 16, 21];

const closePickupRequsets = async () => {
    try {
        const openRequests = await PICKUP_REQUEST_MODEL.getOpenPickupRequests()
        for (const iterator of openRequests) {
            const { id: pickup_request_id } = iterator;
            const orders = await ORDERS_MODEL.getOrdersByPickupRequestIdAndStatus(pickup_request_id, eligble_status_for_assign);
            if (!orders.length) {
                console.log(iterator)
                await PICKUP_REQUEST_MODEL.updatePickupRequest({ state: 6 }, pickup_request_id);
            }
        }
    } catch (exception) {
        console.error(exception)
    } finally {
        process.exit();
    }
}


closePickupRequsets()