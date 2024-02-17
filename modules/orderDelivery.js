"use strict"

const DELIVERY_MODEL = require('../models/orderDelivery')
const ORDERS_MODEL = require("../models/orders")
const { getHubDetailsByPincodeAndStatus } = require('../models/hub_pincode_mapping')
const DELIVERY_REQUEST = require('../modules/pickupDeliveryRequest')
const EVENT_CONTROLLER = require('../controller/event')
const { insertErrorLog } = require('../models/error_logs')
const HUB_STATUS_FOR_DELIVERY = [2, 3]
const ORDER_SOURCE = {
    1: "shypmax_rto", 2: 'shypmax_import', 3: 'importee', 4: 'shypmax', 5 : 'shypmax'
}

const savedeliveryOrder = async (package_details = {}) => {
    try {
        const { pincode, location_id, awb = null } = package_details
        const servicable_hub = await getHubDetailsByPincodeAndStatus(pincode, HUB_STATUS_FOR_DELIVERY)
        try {
            if (!servicable_hub.length) {
                throw new Error("Pincode not servicable")
            }

            if (!awb) {
                throw new Error('Awb not found in request')

            }
            const is_exist_order = await ORDERS_MODEL.getOrderDetailByLm(awb)

            if (is_exist_order.length) {
                throw new Error("AWB already exist in system");
            }

            if (!location_id) {
                throw new Error("Please provide location_id")
            }

        } catch (exception) {
            console.error(exception)
            await insertErrorLog("", `Error while inserting/updating Delivery:${exception}, ${JSON.stringify(package_details)}`)
            return true
        }
        

        const { hub_id, cutoff_time } = servicable_hub[0]
        const delivery_location_id = await insertOrUpdateDeliveryAddr(package_details)
        const delivery_req_data = {
            delivery_location_id, hub_id, cutoff_time, order_count: 1
        }
        // const delivery_request = await DELIVERY_REQUEST.createDeliveryRequest(delivery_req_data)

        // const { delivery_req_id, route_request_assigned_id, rider_assigne_to_delivery_req } = delivery_request

        await saveOrderDetails({ package_details, hub_id })

        return true;

    } catch (exception) {
        console.error(exception)
        await insertErrorLog("", `Error while inserting/updating Delivery:${exception}, ${JSON.stringify(package_details)}`)
        throw new Error(exception.message || exception)
    }
}


const insertOrUpdateDeliveryAddr = async (package_details) => {
    try {
        const { source, location_id, contact_name, contact_number, address, state, city, pincode, consignee_id } = package_details

        const delivery_location = {
            contact_name,
            contact_number,
            address,
            state,
            city,
            pincode,
            consignee_address_id: location_id,
            type: source,
            consignee_id: consignee_id || null,
        }

        const delivery_address_details = await DELIVERY_MODEL.getDeliveryAddress(delivery_location.type, delivery_location.consignee_address_id)

        let delivery_location_id

        if (delivery_address_details.length) {
            delivery_location_id = delivery_address_details[0].id
            await DELIVERY_MODEL.updateDeliveryAddress(delivery_location_id, delivery_location)
        } else {
            const result = await DELIVERY_MODEL.insertDeliveryAddr(delivery_location)
            delivery_location_id = result.insertId
        }

        return delivery_location_id
    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message || exception)
    }
}


const saveOrderDetails = async (orderDetails) => {
    try {
        const {
            package_details: {
                awb,
                shypmax_id,
                consignee_id,
                package_length = 0,
                package_width = 0,
                package_height = 0,
                package_weight = 0,
                package_value = 0,
                manifest_id = null,
                order_date,
                mode = null,
                order_number = null,
                db_order_id = null,
                location_id,
                source
            },
            delivery_req_id = null,
            hub_id,
            rider_assigne_to_delivery_req = false,
            route_request_assigned_id = null
        } = orderDetails

        let order_data = {
            awb,
            shypmax_id: shypmax_id || awb,
            seller_id: consignee_id || null,
            package_length: Number(package_length) || 0,
            package_width: Number(package_width) || 0,
            package_height: Number(package_height) || 0,
            package_weight: Number(package_weight) || 0,
            package_value: Number(package_value) || 0,
            manifest_id,
            deliver_request_id: delivery_req_id,
            status: 100,
            pickup_delivery: 2,
            order_date,
            mode : mode || null,
            hub_id,
            order_receive_date: new Date(),
            order_number,
            sy_order_id: db_order_id,
            sy_warehouse_id: location_id,
            source: ORDER_SOURCE[source]
        }

        let order_status = 100

        if (rider_assigne_to_delivery_req) {
            order_data.status = 101
            order_data.route_request_assigned_id = route_request_assigned_id
        }
        const saveOrder = await ORDERS_MODEL.saveOrderDetails(order_data)
        order_data.id = saveOrder.insertId
        const EVENT = new EVENT_CONTROLLER()

        let event_obj = {
            status: order_status,
            orders: [order_data],
            delivery: true
        }

        await EVENT.createEvent(event_obj)

        if (rider_assigne_to_delivery_req) {
            event_obj.status = 101
            event_obj.route_request_assigned_id = route_request_assigned_id
            await EVENT.createEvent(event_obj)

        }

    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message || exception)
    }
}

module.exports = {
    savedeliveryOrder
}