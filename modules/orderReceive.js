const { receiveMessage, deleteMessage, sendMessage } = require('../modules/sqs');
const HUB_PINCODE_MODEL = require('../models/hub_pincode_mapping')
const SQS_JSON = require('../../shyptrack-static/sqs.json')
const ORDERS_MODEL = require("../models/orders");
const PICKUP_LOCATION = require('../models/pickup_location')
const { insertErrorLog } = require('../models/error_logs');
const { getAndUpdateLatLng } = require('./locationService')


const ORDERS_QUEUE_URL = process.env.NODE_ENV === "production" ? SQS_JSON.production["new-order-shyptrack"] : SQS_JSON.staging["new-order-shyptrack"];
const receiveOrders = async (orders) => {
    try {
        await sendMessage(ORDERS_QUEUE_URL, orders)
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const fetchNonManifestedOrders = async () => {
    console.log(__line, 'fetchNonManifestedOrders')
    let data_received_in_queue = false
    try {
        const QUEUE_RESPONSE = await receiveMessage(ORDERS_QUEUE_URL)

        if (!QUEUE_RESPONSE.hasOwnProperty('Messages') || !QUEUE_RESPONSE?.Messages?.length) {
            console.log("No data in queue in orders")
            return;
        }
        console.log("data in order receive queue ", QUEUE_RESPONSE.Messages.length)

        const message = QUEUE_RESPONSE.Messages[0]
        data_received_in_queue = true;
        await saveOrders(message.Body)

        await deleteMessage(ORDERS_QUEUE_URL, message.ReceiptHandle)

    } catch (exception) {
        console.error(exception)
        await insertErrorLog("", `Error while inserting non-manifiested order, Details : ${JSON.stringify(exception)}`)
    } finally {
        await new Promise(resolve => setImmediate(async () => await fetchNonManifestedOrders()))
    }
}

const saveOrders = async (orders) => {
    try {

        orders = JSON.parse(orders)
        const order_pincodes = orders.map(item => item.pickup_pincode);

        const registered_pincodes = await HUB_PINCODE_MODEL.getMatchedPincodes(order_pincodes);

        const valid_pincodes = registered_pincodes.map(item => Number(item.pincode));

        for (const element of orders) {
            if (valid_pincodes.includes(Number(element.pickup_pincode))) {

                const keys_in_ele = ["shypmax_id", "awb", "seller_id", "manifest_id", "order_number", "sy_order_id", "sy_warehouse_id", "order_date", "mode", "package_length", "package_width", "package_weight", "package_height", "package_value", "pickup_delivery", "sy_warehouse_id", "pickup_contact_name", "pickup_contact_number", "pickup_address", "pickup_state", "pickup_city", "pickup_pincode"]

                const has_all_keys = keys_in_ele.every(item => element.hasOwnProperty(item));

                if (!has_all_keys) {
                    return;
                }

                const hub_id = registered_pincodes[registered_pincodes.map(item => Number(item.pincode)).indexOf(Number(element.pickup_pincode))].hub_id;

                let orders_arr = []
                orders_arr.push([
                    element.shypmax_id.trim(),
                    element.awb.trim(),
                    element.seller_id,
                    element.manifest_id || 0,
                    element.order_number,
                    element.sy_order_id,
                    element.sy_warehouse_id,
                    element.order_date,
                    element.mode,
                    element.package_length,
                    element.package_width,
                    element.package_weight,
                    element.package_height,
                    element.package_value,
                    0, //status order recived
                    hub_id,
                    element.pickup_delivery
                ])

                if (orders_arr.length) {
                    const fields_to_insert = [
                        "shypmax_id",
                        "awb",
                        "seller_id",
                        "manifest_id",
                        "order_number",
                        "sy_order_id",
                        "sy_warehouse_id",
                        "order_date",
                        "mode",
                        "package_length",
                        "package_width",
                        "package_weight",
                        "package_height",
                        "package_value",
                        "status",
                        "hub_id",
                        "pickup_delivery"
                    ];

                    await ORDERS_MODEL.insertData(fields_to_insert, orders_arr);
                }

                const [pickupLocation] = await PICKUP_LOCATION.getPickupLocationDetails(element.sy_warehouse_id);
                if (pickupLocation) {
                    const { id: pickupLocationId, address, city, pincode, lat, lng } = pickupLocation;
                    //update lat lng in existing pickup location where lat lng is null
                    if (!lat && !lng) {
                        const fullAddress = [address, city, pincode].join(',');
                        if (fullAddress && pickupLocationId) {
                            getAndUpdateLatLng(fullAddress, "pickupLocation", pickupLocationId);
                        }
                    }
                } else {
                    let warehouse_data = {
                        sy_warehouse_id: element.sy_warehouse_id,
                        contact_name: element.pickup_contact_name,
                        contact_number: element.pickup_contact_number,
                        address: element.pickup_address,
                        state: element.pickup_state,
                        city: element.pickup_city,
                        pincode: element.pickup_pincode,
                        seller_id: element.seller_id
                    }
                    const savePickupLocation = await PICKUP_LOCATION.savePickupLocation(warehouse_data);
                    const pickupLocationId = savePickupLocation?.insertId;
                    const fullAddress = [warehouse_data.address, warehouse_data.city, warehouse_data.pincode].join(',');
                    if (fullAddress && pickupLocationId) {
                        getAndUpdateLatLng(fullAddress, "pickupLocation", pickupLocationId);
                    }
                }
            }
        }

    } catch (exception) {
        console.error(exception);
        throw error;
    }
}


module.exports = { fetchNonManifestedOrders, receiveOrders };
