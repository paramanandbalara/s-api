"use strict";

const failureReasonModel = require('../models/failure_reason')
const pickupRequestModel = require('../models/pickup_request');
const routeAssignmentModel = require('../models/routeAssignment')
const ordersModel = require('../models/orders');
const EventController = require('./event');
const dayjs = require('dayjs');
const pickupRequestModule = require('../modules/pickupDeliveryRequest')


const CsvWriter = require('../modules/csvWriter');
const os = require("os");
const S3_MODULE = require('../modules/s3');

const schema = [
    { header: "Pickup Request No", key: "pickup_request_no" },
    { header: "Pickup Date", key: "pickup_date", coerceString: true },
    { header: "Status Date", key: "status_date" },
    { header: "Reason", key: "reason" },
    { header: "Manifest Id", key: "manifest_id" },
    { header: "Rider Name", key: "rider_name" },
    { header: "Hub Code", key: "code" },
    { header: "City", key: "city" },
    { header: "Seller Id", key: "seller_id" },
    { header: "Seller Address", key: "seller_address" },
];

const BATCH_SIZE = 100;

class FAILURE_REASON {

    static DEFAULT_PAGE = 1;
    static DEFAULT_LIMIT = 25;


    async getFailureReason(type) {
        try {

            let result = await failureReasonModel.getFailureReason(type);

            return { data: result };
        }
        catch (exception) {
            throw new Error(exception.message || exception)
        }
    }


    async updatePickupRequest(body) {
        try {
            const {
                pickup_request_no: pickupRequestNo,
                failure_reason_id: failureReasonId,
            } = body;
            let { route_request_assigned_id: existingRouteRequestAssignedId } = body;

            const orderStatus = 16;

            const [pickupRequest] = await routeAssignmentModel.getPickupRequestDetailsByPRNo(
                pickupRequestNo
            );

            if (!pickupRequest) {
                throw new Error('Pickup request not found.');
            }

            const {
                pickup_location_id: pickupLocationId,
                hub_id: hubId,
                id: pickupRequestId,
            } = pickupRequest;

            if (!existingRouteRequestAssignedId) {
                const pickupTripData = await routeAssignmentModel.getRouteAssignmentId(
                    pickupRequestId,
                    null
                );

                if (!pickupTripData.length) {
                    throw new Error('Something went wrong.');
                }

                existingRouteRequestAssignedId = pickupTripData[0].id;
            }

            const orders = await ordersModel.getOrdersByPickupRequestId(
                existingRouteRequestAssignedId
            );
            const ordersForEvent = [];
            let reassignPickupRequestId = null;

            orders.forEach((element) => {
                if (element.status === 3) {
                    ordersForEvent.push(element);
                }
            });

            await pickupRequestModel.updatePickupRequest(
                { state: 3 },
                pickupRequestId
            );

            if (ordersForEvent.length) {
                reassignPickupRequestId = await pickupRequestModule.updateOrderAndCreatePickupRequest({
                    ordersForEvent,
                    pickupLocationId,
                    pickupRequestNo,
                    orderStatus,
                    existingRouteRequestAssignedId,
                    hubId,
                });
            }

            await routeAssignmentModel.updateRouteRequest(
                {
                    failure_reason: failureReasonId,
                    status: 1,
                    type: 1,
                    reassign_pickup_request_id: reassignPickupRequestId,
                },
                existingRouteRequestAssignedId
            );

        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async updateDeliverRequest(body) {
        try {
            let { delivery_request_no, route_request_assigned_id: existing_route_request_assigned_id, failure_reason_id } = body

            const delivery_order_status = 104
            const deliveryRequestData = await pickupRequestModel.getDeliveryRequestId(delivery_request_no)
            if (!deliveryRequestData.length) {
                throw new Error('Delivery request not found.')
            }
            const deliveryReq = deliveryRequestData[0]

            const { delivery_location_id, hub_id, id: deliveryReqId } = deliveryReq

            if (!existing_route_request_assigned_id) {
                let deliveryTripData = await routeAssignmentModel.getRouteAssignmentId(null, deliveryReqId);

                if (!deliveryTripData.length) {
                    throw new Error("Something went wrong.")
                }
                existing_route_request_assigned_id = deliveryTripData[0].id;
            }

            let orders = await ordersModel.getOrdersByDeliveryRequestId(existing_route_request_assigned_id);
            let order_ids = []
            let orders_for_event = []
            let reassign_pickup_request_id = null;

            orders.forEach(element => {
                if (element.status == 101) {
                    order_ids.push(element.id)
                    orders_for_event.push(element)
                }
            });
            await pickupRequestModel.updateDeliveryRequest({ state: 3 }, deliveryReqId)

            if (order_ids.length) {
                reassign_pickup_request_id = await this.updateOrderAndCreateDeliveryReq({ order_ids, orders_for_event, delivery_location_id, delivery_request_no, delivery_order_status, existing_route_request_assigned_id, hub_id })
            }

            await routeAssignmentModel.updateRouteRequest({ "failure_reason": failure_reason_id, "status": 1, "type": 1, reassign_pickup_request_id }, existing_route_request_assigned_id)

            return true;
        }
        catch (exception) {
            throw new Error(exception.message || exception)
        }
    }


    async updateOrderAndCreateDeliveryReq(data) {
        try {
            const { order_ids, orders_for_event, delivery_location_id, delivery_request_no, existing_route_request_assigned_id, hub_id } = data

            const delivery_req_data = {
                delivery_location_id, hub_id, order_count: order_ids.length, delivery_request_no
            }
            const delivery_request = await pickupRequestModule.createDeliveryRequest(delivery_req_data)
            let { delivery_req_id, route_request_assigned_id } = delivery_request
            const delivery_failed_status = 105
            const update_order_data = {
                status: delivery_failed_status, deliver_request_id: delivery_req_id
            }
            if (route_request_assigned_id) {
                update_order_data.status = 101
                update_order_data.route_request_assigned_id = route_request_assigned_id
            }
            await ordersModel.updateOrderDetails(order_ids, update_order_data)

            const EVENT = new EventController();

            let event_obj = {
                status: delivery_failed_status,
                orders: orders_for_event,
                route_request_assigned_id: existing_route_request_assigned_id,
                delivery: true
            }

            EVENT.createEvent(event_obj);

            if (route_request_assigned_id) {
                event_obj.status = 101;
                event_obj.route_request_assigned_id = route_request_assigned_id;
                EVENT.createEvent(event_obj);
            }
            return delivery_req_id;

        } catch (exception) {
            throw new Error(exception.message || exception)
        }
    }


    async getFailedAwbs(filters, user_id) {

        try {

            let hasNext = false, hasPrev = false;

            const page_no = parseInt(filters.page ?? FAILURE_REASON.DEFAULT_PAGE);

            let limit = parseInt(filters.offsets ?? FAILURE_REASON.DEFAULT_LIMIT);

            const offset = (page_no - 1) * limit;

            filters['offset'] = offset;

            filters['limit'] = limit + 1;

            let result = await failureReasonModel.getFailedTrips(filters, user_id);

            if (result.length == limit + 1) {
                hasNext = true;
            }

            if (page_no > 1) {
                hasPrev = true;
            }

            result = result.slice(0, limit);

            return { data: result, hasNext, hasPrev };
        }

        catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async getFailedAwbsExport(filters, user_id) {
        try {
            const queryString = await failureReasonModel.getFailedTripExportQuery(filters, user_id);

            const connection = await readDB.getConnection();

            const csv = new CsvWriter()

            const fileName = `failed_awbs_export-${dayjs(new Date()).format('DD-MMM-YYYY')}-${Date.now()}.csv`;

            const filePath = `${os.tmpdir()}/${fileName}`;

            await csv.initialize({ schema, filePath })

            let failed_order_arr = [];

            const addRows = async (data) => {

                let obj = {}

                data.forEach(element => {
                    if (obj.hasOwnProperty(element.route_request_id)) {
                        obj[element.route_request_id]['manifest_id'] += ", " + element.manifest_id
                    } else {
                        obj[element.route_request_id] = element;
                        // obj[element.route_request_id]['failure_reason'] = STATUS[element.failure_reason]
                    }

                });

                data = Object.values(obj)

                data = data.map(i => {
                    i.pickup_request_no = i?.pickup_request_no ? i.pickup_request_no : '-';
                    i.reason = i?.failure_reason || '-';
                    i.manifest_id = i?.manifest_id || '-';
                    i.status_date = dayjs(i?.status_date).format("DD-MM-YYYY") || '-';
                    i.rider_name = i?.rider_name || '-';
                    i.code = i?.code ? i.code : '-';
                    i.city = i?.city ? i.city : '-';
                    i.seller_id = i?.seller_id || '-'
                    i.seller_address = i?.seller_address || '-';
                    i.pickup_date = i?.pickup_date ? dayjs(i.pickup_date).format("DD-MM-YYYY") : '-';

                    return i;
                })

                for (let i of data) {
                    csv.writeRow(i)
                }
            }

            const promise = new Promise((resolve, reject) => {

                connection.connection.query(queryString)
                    .on('error', (err) => {
                        connection.release();
                        reject(err);
                    })
                    .on('result', async (i) => {

                        failed_order_arr.push(i);

                        if (failed_order_arr.length < BATCH_SIZE)
                            return

                        connection.pause();

                        await addRows(failed_order_arr, csv)

                        failed_order_arr = []

                        connection.resume();
                    })
                    .on('end', async () => {
                        connection.release();

                        if (failed_order_arr.length > 0) {

                            await addRows(failed_order_arr, csv)
                        }

                        await csv.closeFile()
                        resolve()
                    })
            })

            await promise;
            const S3 = new S3_MODULE();
            const key = `shyptrackreports/users/${fileName}`;
            const upload = await S3.uploadToS3('', key, filePath);
            const signedURL = await S3.getFilePath(key, 360);

            return signedURL;

        }
        catch (exception) {
            console.error(__line, exception)
            throw new Error(exception.message || exception)
        }
    }
}



module.exports = FAILURE_REASON;