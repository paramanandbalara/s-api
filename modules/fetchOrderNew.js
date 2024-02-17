"use strict"

const ORDERS_MODEL = require("../models/orders")
const SQS_JSON = require('../../shyptrack-static/sqs.json')
const { receiveMessage, deleteMessage } = require('../modules/sqs')
const TRACKING_STATUS = require('../../shyptrack-static/hub_tracking_status.json')
const { updatePickupRequest, getPickupRequestDataByDBId, getAlreadyStatusChangedawbs } = require('../models/pickup_request')
const { insertErrorLog } = require('../models/error_logs')
const PICKUP_REQUEST_MODULE = require('./pickupDeliveryRequest')
const HUB_PINCODE_MODEL = require('../models/hub_pincode_mapping')
const EVENT_CONTROLLER = require('../controller/event')
const EVENT = new EVENT_CONTROLLER();
const { saveOrUpdatePickupLocation } = require('./pickupLocation');


const ORDERS_QUEUE_URL = process.env.NODE_ENV === "production" ? SQS_JSON.production["shyptrack-orders"] : SQS_JSON.staging["shyptrack-orders"];
const ELIGIBLE_FOR_CANCEL_STATUS = [0, 1, 3, 16, 17]; // 0- non manifested 1-- booked 3-- assigned, 16-- pickup-failed, 17- not pickedup only these status can be cancelled 

const fetchAndSaveOrders = async () => {
    console.log(__line, 'fetchAndSaveOrders')
    let dataReceivedInQueue = false;
    try {
        const QUEUE_RESPONSE = await receiveMessage(ORDERS_QUEUE_URL)
        if (!QUEUE_RESPONSE.hasOwnProperty('Messages') || QUEUE_RESPONSE?.Messages?.length == 0) {
            return
        }
        dataReceivedInQueue = true
        console.log('dataReceivedInQueue ', dataReceivedInQueue)
        for (const message of QUEUE_RESPONSE.Messages) {

            let ORDERS = JSON.parse(message?.Body);
            const { cancelOrder, status, sy_order_id, sellerId } = ORDERS

            if ((Array.isArray(ORDERS))) {
                let finalOrderArray = [];
                let awbs = [];
                for (const element of ORDERS) {
                    awbs.push(element.shypmax_id || element.awb)
                    finalOrderArray.push(element);
                }

                let pickedAwbs = [];

                if (awbs.length) {
                    pickedAwbs = await getAlreadyStatusChangedawbs(awbs)
                }

                let pickedUpCount = pickedAwbs.length;

                //check if order already pickedup or status changed from given awbs
                const manifested_orders_count = Number(awbs.length) - Number(pickedUpCount);

                pickedAwbs = pickedAwbs.map(item => item.awb)

                let filteredAwb = awbs.filter((el) => !pickedAwbs.includes(el)); //create event only those orders those status is 0 in db or not existt in db

                if (finalOrderArray.length) {
                    if (manifested_orders_count > 0) {
                        let hub_id;
                        if (!hub_id) {
                            const order_pincode = finalOrderArray[0][`pickup_pincode`];
                            let hub_details = await HUB_PINCODE_MODEL.getHubDetailsByPincodeAndStatus(order_pincode, [1, 2])
                            if (hub_details.length) {
                                hub_id = hub_details[0].hub_id;
                            } else {
                                console.error(__line, `hub_id not servicable...`)
                                await deleteMessage(ORDERS_QUEUE_URL, message.ReceiptHandle)
                                return;
                            }
                        }
                        /**1. insert/update pickup location*/
                        let pickupLocationId = await saveOrUpdatePickupLocation(finalOrderArray[0]).catch(async (e) => {
                            console.error(__line, e);
                            await insertErrorLog("", `Error while inserting/updating pickupLocationId for sy_order_id:${finalOrderArray[0]?.sy_order_id}`)
                        })

                        /**2. generate pickup request*/
                        const PICKUP_REQ_DATA = await PICKUP_REQUEST_MODULE.pickup_request({
                            currentOrderCount: manifested_orders_count,
                            manifestClosedOnTime: finalOrderArray[0].manifest_closed_on,
                            hubId: hub_id,
                            hub_cutoff_time: finalOrderArray[0].hub_cutoff_time,
                            pickupLocationId: pickupLocationId,
                            mode: finalOrderArray[0].mode,
                            packageValue: finalOrderArray[0].package_value
                        }).catch(async (e) => {
                            console.error(__line, e);
                            await insertErrorLog("", `Error while inserting/updating pickup_request for sy_order_id:${finalOrderArray[0]?.sy_order_id}`)
                        });

                        let { pickup_request_id, riderAssignedToPickupRequest, route_request_assigned_id } = PICKUP_REQ_DATA
                        /**3. insert order details */

                        await saveOrders(finalOrderArray, pickup_request_id, riderAssignedToPickupRequest, filteredAwb, route_request_assigned_id, hub_id)

                    }
                }

            } else if (cancelOrder) {
                /**
                 * 1.update order status and pickup req
                 * 2. update pickup_req table (order count)
                 * 3.insert order event
                 */
                const ORDER_DETAILS = await ORDERS_MODEL.getOrderDetailsBySellerIdAndSyOrderId(sy_order_id, sellerId)
                    .catch(async (e) => {
                        console.error(__line, e);
                        await insertErrorLog("", `Cancel order: Error while fetching order details for sy_order_id : ${sy_order_id},seller id : ${sellerId}`)
                    });
                if (ORDER_DETAILS.length == 0) {
                    await insertErrorLog("", `Cancel order: No order details found for sy_order_id : ${sy_order_id},seller id : ${sellerId}`)
                    await deleteMessage(ORDERS_QUEUE_URL, message.ReceiptHandle)
                    return;
                }
                if (!ELIGIBLE_FOR_CANCEL_STATUS.includes(Number(ORDER_DETAILS[0].status))) {
                    await insertErrorLog("", `Order cannot be cancelled as it is already processed further : ${sy_order_id},seller id : ${sellerId}`)
                    await deleteMessage(ORDERS_QUEUE_URL, message.ReceiptHandle)
                    return;
                }
                await ORDERS_MODEL.updateOrder({ status: status }, sy_order_id, sellerId)
                    .catch(async (e) => {
                        console.error(__line, e);
                        await insertErrorLog("", `Cancel order: Error while updating order status to cancel for sy_order_id : ${sy_order_id},seller id : ${sellerId}`)
                    });
                if (ORDER_DETAILS[0].status != 0 && ORDER_DETAILS[0]?.pickup_request_id) {
                    /**2 update pickup_req table*/
                    const PICKUP_REQUEST = await getPickupRequestDataByDBId(ORDER_DETAILS[0]?.pickup_request_id)
                        .catch(async (e) => {
                            console.error(__line, e);
                            await insertErrorLog("", `Cancel order: Error while fetching pickup request while cancellation for sy_order_id : ${sy_order_id},seller id : ${sellerId}`)
                        });
                    if (PICKUP_REQUEST.length) {
                        const updatedManifestedOrdersCount = Number(PICKUP_REQUEST[0].manifested_orders_count) - 1;
                        const updatedPendingOrdersCount = Number(PICKUP_REQUEST[0].pending_order_count) - 1;
                        await updatePickupRequest({ manifested_orders_count: updatedManifestedOrdersCount, pending_order_count: updatedPendingOrdersCount }, ORDER_DETAILS[0].pickup_request_id)
                            .catch(async (e) => {
                                console.error(__line, e);
                                await insertErrorLog("", `Cancel order: Error while updating pickup request ,for sy_order_id : ${sy_order_id},seller id : ${sellerId}`)
                            });
                    }
                }

                const eventData = { orders: ORDER_DETAILS, status: TRACKING_STATUS.cancelled.status }
                await prepareAndInsertOrdersEvent(eventData)
                    .catch(async (e) => {
                        console.error(__line, e);
                        await insertErrorLog("", `Cancel order: Error while inserting order Events ,Order Details : ${JSON.stringify(ORDER_DETAILS)}`)
                    });
            }
            await deleteMessage(ORDERS_QUEUE_URL, message.ReceiptHandle)
        }

    } catch (exception) {

        if (!exception?.message?.includes("No data in queue"))
            await insertErrorLog("", exception?.message || JSON.stringify(exception))
        console.error(__line, exception)
    }
    finally {
        await new Promise(resolve => setImmediate(async () => await fetchAndSaveOrders()))
    }

}

const saveOrders = async (finalOrderArray, pickup_request_id, riderAssignedToPickupRequest, filteredAwb, route_request_assigned_id, hub_id) => {
    try {
        for (const { shypmax_id, awb, seller_id, manifest_id, mps_master_child, order_number, sy_order_id, sy_warehouse_id, order_date, mode, package_length, package_width, package_weight, package_height, package_value, status, pickup_city, pickup_state } of finalOrderArray) {
            const order_receive_date = new Date();
            const orderData = {
                shypmax_id: shypmax_id.trim(),
                awb: awb?.trim() ?? element.lm_awb.trim(),
                seller_id,
                manifest_id,
                mps_master_child,
                order_number,
                sy_order_id,
                sy_warehouse_id,
                order_date,
                mode,
                package_length,
                package_width,
                package_weight,
                package_height,
                package_value,
                hub_id,
                order_receive_date,
                ...getOrderStatusAndDetails(riderAssignedToPickupRequest, pickup_request_id, route_request_assigned_id, status),
            };
            const [existingOrder] = await ORDERS_MODEL.getOrderDetailsByAwbOrShypmaxId([orderData.shypmax_id], [orderData.awb]);
            if (existingOrder && existingOrder.orderStatus === 0) {
                const updateOrderData = { ...getOrderStatusAndDetails(riderAssignedToPickupRequest, pickup_request_id, route_request_assigned_id, status), order_receive_date }
                await ORDERS_MODEL.updateOrderDetails([existingOrder.id], updateOrderData);
            } else if (!existingOrder) {
                await ORDERS_MODEL.saveOrderDetails(orderData);
            }
        }

        const orderDetails = await ORDERS_MODEL.getOrderDetailsByAwbOrShypmaxId(filteredAwb, filteredAwb);
        const eventData = {
            orders: orderDetails,
            status: TRACKING_STATUS.booked.status,
            riderAssignedToPickupRequest,
            currentLocation: `${finalOrderArray[0].pickup_city},${finalOrderArray[0].pickup_state}`,
            route_request_assigned_id,
            hub_id
        };
        await insertOrderEvents(eventData);
    } catch (exception) {
        console.error(__line, exception);
        throw Error(exception);
    }
};

const getOrderStatusAndDetails = (riderAssignedToPickupRequest, pickup_request_id, route_request_assigned_id, status) => {
    return {
        status: riderAssignedToPickupRequest ? TRACKING_STATUS.assigned.status : status,
        pickup_request_id,
        route_request_assigned_id: route_request_assigned_id || null,
    };
};

const insertOrderEvents = async (eventData) => {
    try {
        await prepareAndInsertOrdersEvent(eventData);
    } catch (e) {
        console.error(__line, e);
        await insertErrorLog("", `Error while inserting order Events ,Order Details : ${JSON.stringify(eventData.orders)}`);
    }
};




const prepareAndInsertOrdersEvent = async (eventData) => {
    let { orders, status, riderAssignedToPickupRequest = false, currentLocation, route_request_assigned_id = null } = eventData;
    try {
        let event_obj = {
            status: status,
            orders: orders,
            current_location: currentLocation
        }
        await EVENT.createEvent(event_obj)
        if (riderAssignedToPickupRequest) {
            event_obj.route_request_assigned_id = route_request_assigned_id
            event_obj.status = 3;
            await EVENT.createEvent(event_obj)
        }

    } catch (error) {
        console.error(__line, error)
        throw Error(error)
    }
}

module.exports = { fetchAndSaveOrders };
