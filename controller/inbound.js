'use strict'

const dayjs = require('dayjs')

const ordersModel = require('../models/orders')
const inboundModel = require('../models/inbound')
const baggingModel = require('../models/bagging')
const EVENT_CONTROLLER = require('./event')
const S3_MODULE = require('../modules/s3');
const os = require("os");
const CsvWriter = require('../modules/csvWriter');
const BAGGING = require('../models/bagging');
const hub_tracking_status = require('../../shyptrack-static/hub_tracking_status.json');
const orderDeliveryModel = require('../models/orderDelivery')
const deliveryRequest = require('../modules/pickupDeliveryRequest')
const { error } = require('console')
const ORDER_SOURCE = {
    1: "shypmax_rto", 2: 'shypmax_import', 3: 'importee', 4: 'shypmax', 5: 'shypmax'
}

const BATCH_SIZE = 100;

const schema = [
    { header: "AWB", key: "awb", coerceString: true },
    { header: "Bag Code", key: "bag_code", coerceString: true },
    { header: "Bag Seal No", key: "bag_sealno", coerceString: true },
    { header: "Bag Date", key: "bag_date", coerceString: true },
    { header: "Bag Weight", key: "bag_weight", coerceString: true },
    { header: "Gateway Inscan Date", key: "gateway_inscan_date", coerceString: true },
    { header: "OutScan Date", key: "outscan_date", coerceString: true },
    { header: "Transporter Awb No", key: "transporter_awbno", coerceString: true },
    { header: "Inbound Awb Count", key: "inbound_awb_count" },
    { header: "Hub Code", key: "hub_code" },
    { header: "Status", key: "status", coerceString: true }

];


const EVENT = new EVENT_CONTROLLER();
class InBound {

    static inbound_status = 11;
    static DEFAULT_PAGE = 1;
    static DEFAULT_LIMIT = 25;

    async getInboubdBagDetails(code, user_id, gateway_id) {
        try {
            if (code) code = code.trim();

            const inbound_status = InBound.inbound_status;

            let rows = await inboundModel.getInboubdBagDetails(code);

            if (!rows.length) {
                throw new Error('Please enter correct Bag Code/Seal No.')
            }

            let bag_details = rows[0]

            if (bag_details.bag_state == 3) { //closed bag
                throw new Error('Inbound already completed')
            }

            if (bag_details.bag_state != 2 || !bag_details.outscan_date) { //closed bag
                throw new Error('Bag not Outscanned from Origin hub')
            }

            if (bag_details.gateway_id != gateway_id) {
                throw new Error("Bag doesn't belong to selected hub, please check and select correct hub")
            }
            const bag_id = bag_details.id;


            if (!bag_details.gateway_inscan_date) {
                const gateway_inscan_date = new Date();

                const update_bag = await baggingModel.updateBagDetails([bag_id], { gateway_inscan_date });

                bag_details[`gateway_inscan_date`] = gateway_inscan_date;

                const inbound_completed = 15; //TODO need to addd dynamic from hub_tracking
                await this.createbagwiseOrderEvent(bag_id, inbound_completed)
            }
            const inbound_awb_count = await inboundModel.inbound_awb_count(bag_id, inbound_status);



            bag_details[`inbound_awb_count`] = inbound_awb_count.inbound_awb_count;

            return bag_details;
        } catch (exception) {
            console.log(exception);
            throw new Error(exception.message || exception)
        }
    }

    async inboundOrder(awb, bagId) {
        try {
            // Trim whitespace from `awb`
            if (awb) {
                awb = awb.trim();
            }

            // Check if `awb` exists in orders model
            const [awbDetails] = await ordersModel.checkWhetherAwbExist(awb);
            if (!awbDetails) {
                throw new Error('AWB not found or already manifested');
            }

            // Get order details by `awb` and `bagId`
            const [orderDetails] = await inboundModel.getOrderDetailsByLMAndbag(awb, bagId);
            const [bagDetails] = await baggingModel.getBagDetailsById(bagId);
            const { gateway_id: hubId } = bagDetails;

            // Update order status to inbound
            const inboundStatus = InBound.inbound_status;
            const updateOrderData = { status: inboundStatus };

            if (!orderDetails) {
                throw new Error(`No order found for AWB (${awb})`);
            }
            const { status: orderStatus, pickup_delivery: pickupDelivery, id: orderId } = orderDetails;

            if (orderStatus === inboundStatus) {
                throw new Error('Order already scanned at gateway');
            }

            if (orderStatus !== 15) { // not outscanned
                throw new Error('Order not yet outscanned from hub');
            }

            let riderAssigned = false;
            let routeReqId = null
            if (pickupDelivery === 2) {
                // Create delivery request if pickup delivery type
                const { delivery_req_id, route_request_assigned_id, rider_assigne_to_delivery_req } = await this.createDeliveryRequest(orderDetails, hubId);
                updateOrderData.deliver_request_id = delivery_req_id;
                updateOrderData.route_request_assigned_id = route_request_assigned_id;
                riderAssigned = rider_assigne_to_delivery_req;
                routeReqId = route_request_assigned_id;
            }


            // Create inbound event and update order status
            const eventObj = { status: inboundStatus, orders: [orderDetails] };
            await EVENT.createEvent(eventObj);

            if (riderAssigned) {
                updateOrderData.status = 101;
                eventObj.status = 101
                eventObj.route_request_assigned_id = routeReqId;
                await EVENT.createEvent(eventObj);
            }
            await ordersModel.updateOrderDetails([orderId], updateOrderData);

            return true;
        } catch (error) {
            console.error(error);
            throw new Error(`Inbound order failed: ${error.message || error}`);
        }
    }


    async createDeliveryRequest(orderDetails, hubId) {
        try {
            const { source, sy_warehouse_id: location_id } = orderDetails;

            const orderSource = Object.keys(ORDER_SOURCE).find(key => ORDER_SOURCE[key] === source);

            if (!orderSource) {
                throw new Error('Invalid order source');
            }

            const [deliveryLocationDetails] = await orderDeliveryModel.getDeliveryAddress(orderSource, location_id);
            if (!deliveryLocationDetails) {
                throw new Error('Delivery location not found');
            }
            const { id: delivery_location_id } = deliveryLocationDetails;

            const deliveryReqData = {
                delivery_location_id,
                hub_id: hubId,
                order_count: 1
            };

            const { delivery_req_id,
                route_request_assigned_id,
                rider_assigne_to_delivery_req } = await deliveryRequest.createDeliveryRequest(deliveryReqData);

            return {
                delivery_req_id,
                route_request_assigned_id,
                rider_assigne_to_delivery_req
            };
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async getMissingOrder(user_id, bag_id) {
        try {

            const inbound_status = InBound.inbound_status;

            const missing_order = await inboundModel.getMissingOrder(bag_id, inbound_status);

            return missing_order;
        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception)
        }
    }

    async completeInbound(user_id, bag_id, body) {
        try {
            const { missing_awbs } = body;

            const result = await baggingModel.updateBagDetails([bag_id], { bag_state: 3 });

            if (missing_awbs.length) {
                await this.markMissingDamageOrders(missing_awbs);

            }

            return true;

        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception)
        }
    }

    async markMissingDamageOrders(missing_awbs) {
        try {

            const inbound_missing_status = 12; //TODO need to add dynamic
            const inbound_damage_status = 13;

            let missing_awb = [];
            let damage_awb = [];

            missing_awbs.forEach(item => {
                if (item.reason == 1)
                    missing_awb.push(item.awb)
                else damage_awb.push(item.awb)
            });

            let event_obj = {};

            if (missing_awb.length) {
                const missing_orders = await ordersModel.getOrderDetailByLm(missing_awb);
                const missing_order_ids = missing_orders.map(item => item.id)
                if (missing_order_ids.length) {

                    event_obj['status'] = inbound_missing_status;
                    event_obj['orders'] = missing_orders;

                    const create_order_event = await EVENT.createEvent(event_obj);
                    await ordersModel.updateOrderDetails(missing_order_ids, { status: inbound_missing_status })

                }
            }
            if (damage_awb.length) {
                const damage_orders = await ordersModel.getOrderDetailByLm(damage_awb);
                const damage_orders_ids = damage_orders.map(item => item.id)
                if (damage_orders_ids.length) {

                    event_obj['status'] = inbound_damage_status;
                    event_obj['orders'] = damage_orders;

                    const create_order_event = await EVENT.createEvent(event_obj)
                    await ordersModel.updateOrderDetails(damage_orders_ids, { status: inbound_damage_status })

                }
            }
        } catch (exception) {
            console.error(exception)
            throw exception;
        }
    }

    async inboundBagList(page_no, offset_row, gateway_id) {
        try {
            if (!gateway_id) {
                throw new Error("Please select hub")
            }

            const inbound_status = InBound.inbound_status;

            let hasNext = false, hasPrev = false;
            let page = parseInt(page_no ?? InBound.DEFAULT_PAGE);
            let limit = parseInt(offset_row ?? InBound.DEFAULT_LIMIT);

            //Page no. starts from 1
            let offset = (page - 1) * limit;

            let rows = await inboundModel.inboundBagsList(gateway_id, offset, limit + 1);
            let getBagIds = await inboundModel.getInboundBagID(gateway_id)

            let bagIdsArr = getBagIds.map(({ id }) => id)

            let inbound_awb_count = []
            if (bagIdsArr.length){
                inbound_awb_count = await inboundModel.inboundAwbCount(bagIdsArr, InBound.inbound_status)
            }
            const inboundCount = inbound_awb_count.reduce((acc, cur) => {
                acc[cur.bag_id] = cur;
                return acc;
            }, {});

            rows = rows.map(item => {
                item['inbound_awb_count'] = inboundCount[item.id]?.expected_awb_count
                delete item.id;
                return item
            })

            if (rows.length == limit + 1)
                hasNext = true;

            if (page > 1)
                hasPrev = true;

            rows = rows.slice(0, limit);

            return { data: rows, hasNext, hasPrev };

        } catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async exportBagDetails(filters, gateway_id) {
        try {
            const queryString = await inboundModel.getInboundExportData(filters, gateway_id);
            let getBagIds = await inboundModel.getInboundBagID(gateway_id, filters)
            let bagIdsArr = getBagIds.map(({ id }) => id)
            let inbound_awb_count = []
            if (getBagIds.length) {
                inbound_awb_count = await inboundModel.inboundAwbCount(bagIdsArr, InBound.inbound_status)
            }
            const inboundCount = inbound_awb_count.reduce((acc, cur) => {
                acc[cur.bag_id] = cur;
                return acc;
            }, {});

            const connection = await readDB.getConnection();

            const csv = new CsvWriter()

            const fileName = `inbound_export-${dayjs(new Date()).format('DD-MMM-YYYY')}-${Date.now()}.csv`;
            const filePath = `${os.tmpdir()}/${fileName}`;

            await csv.initialize({ schema, filePath })
            let inbound_bags = [];

            const addRows = async (data) => {
                data = data.forEach(item => {
                    item.inbound_awb_count = inboundCount[item.id.toString()]?.expected_awb_count || '-'
                    const status = Object.keys(hub_tracking_status).find(key => hub_tracking_status[key][`status`] == item[`status`]);
                    item.status = hub_tracking_status?.[status]?.[`remark`] || '-';
                    item.bag_code = item.bag_code ? item.bag_code : '-';
                    item.bag_sealno = item.bag_sealno ? item.bag_sealno : '-';
                    item.bag_date = item.bag_date ? dayjs(item.bag_date).format('DD-MM-YYYY') : '-';
                    item.bag_weight = item.bag_weight ? item.bag_weight : '-';
                    item.gateway_inscan_date = item.gateway_inscan_date ? dayjs(item.gateway_inscan_date).format('DD-MM-YYYY') : '-';
                    item.outscan_date = item.outscan_date ? dayjs(item.outscan_date).format('DD-MM-YYYY') : '-';
                    item.transporter_awbno = item.transporter_awbno ? item.transporter_awbno : '-';
                    item.hub_code = item?.hub_code ? item.hub_code : '-';
                    item.awb = item?.awb ? item.awb : '-';

                    csv.writeRow(item)
                })
            }

            await new Promise((resolve, reject) => {
                connection.connection.query(queryString)
                    .on('error', (err) => {
                        connection.release();
                        reject(err);
                    })
                    .on('result', async (item) => {
                        inbound_bags.push(item);
                        if (inbound_bags.length < BATCH_SIZE)
                            return
                        connection.pause();
                        await addRows(inbound_bags)
                        inbound_bags = []
                        connection.resume();
                    })
                    .on('end', async () => {
                        connection.release();
                        if (inbound_bags.length > 0) {
                            await addRows(inbound_bags)
                        }
                        await csv.closeFile()
                        resolve()
                    })
            })
            const S3 = new S3_MODULE();
            const key = `reports/${fileName}`;
            await S3.uploadToS3('', key, filePath);
            return S3.getFilePath(key, 360);
        }
        catch (exception) {
            console.error(exception);
            throw exception;
        }
    }

    async createbagwiseOrderEvent(bag_id, status) {
        try {

            const orders_in_bag = await BAGGING.getOrderListByBagId(bag_id);

            if (orders_in_bag.length) {
                const order_ids_arr = orders_in_bag.map(item => item.id);

                let event_obj = {
                    status: status,
                    orders: orders_in_bag
                }

                await EVENT.createEvent(event_obj) //create bag completed order event
                await ordersModel.updateOrderDetails(order_ids_arr, { status: status }) //update order status

            }
        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception)
        }
    }


}


module.exports = InBound;