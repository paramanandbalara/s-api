const express = require('express');
const app = express();
const axios = require('axios')
const crypto = require('crypto')
require('../bin/bootstrap')(app);

const EVENT_CONTROLLER = require('../controller/event')
const EVENT = new EVENT_CONTROLLER();
const SHYPMAX_JSON = require('../../shyptrack-static/shypmax.json')
const ORDERS_MODEL = require('../models/orders')
const { updatePickupRequest, getPickupRequestDataByDBId } = require("../models/pickup_request");
const { stop_failed_pickup: stopFailedPickupCount } = require('../../shyptrack-static/stconfig.json');


const getFailedOrdersAndCheckOnShypmax = async () => {
    try {
        const orders = await ORDERS_MODEL.getFailedOrNotPickedAwbs(Number(stopFailedPickupCount))
        for (const iterator of orders) {
            await checkOrUpdateOrder(iterator)
        }

    } catch (exception) {
        console.error(exception)
    } finally {
        process.exit()
    }
}

const checkOrUpdateOrder = async (data) => {
    try {
        const { shypmax_id, id: order_id, pickup_request_id } = data;
        const config = await getConfig(shypmax_id)
        const res = await axios(config)
        console.log(__line, res?.data, shypmax_id)
        if (res?.data?.success) {
            if (pickup_request_id) {
                const [PICKUP_REQUEST_DETAILS] = await getPickupRequestDataByDBId(pickup_request_id)
                    let { pending_order_count } = PICKUP_REQUEST_DETAILS;
                    pending_order_count = Number(pending_order_count)
                    pending_order_count = pending_order_count === 0 ? 0 : pending_order_count - 1;
                    await ORDERS_MODEL.updateOrderDetails([order_id], { status: 19 })
                    await updatePickupRequest({ pending_order_count }, pickup_request_id)
            }
            let event_obj = {
                status: 19,
                orders: [data]
            }
            await EVENT.createEvent(event_obj);
            return true;
        }
        return false;

    } catch (exception) {
        console.error(exception)
        throw new Error(exception)
    }
}

const getConfig = async (shypmax_id) => {

    const timestamp = +new Date();
    const { SECRET_KEY, PUBLIC_KEY, APP_ID, ORDERS_STATUS_URL } = SHYPMAX_JSON;

    const stringToString = `key:${PUBLIC_KEY}id:${APP_ID}:timestamp:${timestamp}`

    const hash = crypto.createHmac('sha256', SECRET_KEY)
        .update(stringToString)
        .digest("base64").toString()

    const config = {
        method: 'GET',
        url: `${ORDERS_STATUS_URL}/${shypmax_id}`,
        headers: {
            "Content-type": "application/json",
            'authorization': hash,
            "x-appid": APP_ID,
            "x-timestamp": timestamp
        }
    };

    return config;

}

getFailedOrdersAndCheckOnShypmax()