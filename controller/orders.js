const OrdersModel = require('../models/orders')
const HUB_TRACKING_STATUS = require('../../shyptrack-static/hub_tracking_status.json')
const RouteAssignmentModel = require('../models/routeAssignment');
const EventController = require('./event');
const eventController = new EventController();
const UtilClass = require('./util')
const utilClass = new UtilClass()
const PickupLocationModel = require('../models/pickup_location')
const OrderDeliveryModel = require('../models/orderDelivery')
const { SECURE_PICKUP_MODES: securePickupModes = [] } = require('../../shyptrack-static/shypmax.json')
const { uploadDocument } = require('../modules/uploadDocument')
const S3Module = require('../modules/s3');
const {ewaybill_exempt_modes : EWAY_BILL_EXEMPT_MODES} = require('../../shyptrack-static/stconfig.json');


class Orders {

    static DEFAULT_PAGE = 1;
    static DEFAULT_LIMIT = 25;
    static STATUSES_FOR_ALREADY_PICKEDUP_ORDERS = [4, 5, 6, 7, 11]

    async getOrders(filters, status) {
        try {
            //TODO need to break function into parts

            const page = parseInt(filters.page ?? Orders.DEFAULT_PAGE);
            const limit = parseInt(filters.offset ?? Orders.DEFAULT_LIMIT);

            const statusArr = [];

            if (status === 'all') {
                statusArr.push('');
            } else {
                const statusKey = HUB_TRACKING_STATUS?.[status]?.status;
                if (statusKey) {
                    statusArr.push(statusKey);
                }
            }

            if (status === 'bagged') {
                const bagStartedStatus = HUB_TRACKING_STATUS?.['bag-started']?.status;
                if (bagStartedStatus) {
                    statusArr.push(bagStartedStatus);
                }
            }

            if (!statusArr.length) {
                throw new Error('Status is incorrect');
            }

            const offset = (page - 1) * limit;

            const statusStr = statusArr.join(', ');
            filters.user_id = Number(filters.user_id);
            const orders = await OrdersModel.getOrders(offset, limit + 1, statusStr, filters);
            const routeRequestIds = orders.map(({ route_request_assigned_id }) => route_request_assigned_id);
            if (routeRequestIds.length) {
                const routeReqDetails = await OrdersModel.getRiderNameAndFailureReason(routeRequestIds);
                const routeReqsts = routeReqDetails.reduce((acc, cur) => {
                    acc[cur.route_request_assigned_id] = cur;
                    return acc;
                }, {});

                orders.forEach(element => {
                    Object.assign(element, routeReqsts[element.route_request_assigned_id]);
                });
            }

            const hasNext = orders.length === limit + 1;
            const hasPrev = page > 1;

            const processedResult = orders.slice(0, limit).map(item => {
                // Determine the dropOff property based on the presence of dropoff_hub_id
                const isDropOff = Boolean(item.dropoff_hub_id);
                const statusKey = Object.keys(HUB_TRACKING_STATUS).find(key => Number(HUB_TRACKING_STATUS[key].status) === Number(item.status));
                const status = HUB_TRACKING_STATUS[statusKey]?.remark || '';
                const isEwayBillUploaded = Boolean(item.eway_billno);

                return { ...item, isDropOff, status, isEwayBillUploaded };
            });
            ;

            return { data: processedResult, hasNext, hasPrev };
        } catch (exception) {
            throw new Error(exception.message || exception);
        }
    }


    async getDeliveryOrders(filters, status) {
        try {
            let hasNext = false, hasPrev = false;
            const page = Number(filters.page ?? Orders.DEFAULT_PAGE);
            let limit = Number(filters.offset ?? Orders.DEFAULT_LIMIT);

            let status_arr = [status == 'all' ? '' : HUB_TRACKING_STATUS?.[status]?.['status'] || undefined];

            const offset = (page - 1) * limit;

            status_arr = status_arr.join(', ')

            let result = await OrdersModel.deliveryOrderList(filters.user_id, offset, limit + 1, status_arr, filters);

            if (result.length == limit + 1) {
                hasNext = true;
            }

            if (page > 1) {
                hasPrev = true;
            }

            result = result.slice(0, limit);

            result.forEach(item => {
                const status = Object.keys(HUB_TRACKING_STATUS).find(key => HUB_TRACKING_STATUS[key][`status`] == item[`status`]);
                item.status = HUB_TRACKING_STATUS[status][`remark`]
            });

            return { data: result, hasNext, hasPrev };
        }
        catch (exception) {
            console.log(__line, exception)
            throw exception
        }
    }

    async updateRiderAppScanResponse(data) {
        try {
            /**For shypmax rider's pickup via mobile app
             * 1/add order event- Update status to 103 (picked up)
             * 2/update pickup request state to success
             * 2/if pickup request is closed
             */

            let { awb, device_id, lat_long, pickup_request_no, route_request_assigned_id, sy_warehouse_id = null } = data;

            if (!awb.length) {
                throw new Error('awb not found / manifested')
            }

            if (!route_request_assigned_id) {
                throw new Error('Pickup trip not found')
            }

            const picked_order_status = 4;
            const AWB_DETAILS = await utilClass.checkAwbExist(awb);

            let awb_not_found = awb;

            let update_order_data = {
                status: picked_order_status,
                route_request_assigned_id
            }

            let picked_awbs = [];
            let picked_order_ids = []
            const error_awbs_object = {}
            const error_awbs = []
            const non_manifested_arr = [];
            const non_manifested_order_ids = [];
            const orderReceivedStatus = 1
            const orderAssigned = 3
            for (const iterator of AWB_DETAILS) {

                if (!sy_warehouse_id) {
                    let warehouse_details = await RouteAssignmentModel.getWarehouseDetails(route_request_assigned_id);
                    sy_warehouse_id = warehouse_details[0].sy_warehouse_id
                }

                const awb_reg = new RegExp(iterator.awb, "g");
                awb_not_found = awb_not_found.filter(function (e) { return !awb_reg.test(e) })

                if (Orders.STATUSES_FOR_ALREADY_PICKEDUP_ORDERS.includes(iterator.orderStatus)) {
                    let error_msg = `Already pickedup`
                    await this.createErroxrMsgInScan(error_msg, iterator.awb, error_awbs_object, awb)
                    continue;
                }

                if (iterator.orderStatus == 2) {
                    let error_msg = `Order cancelled`
                    await this.createErroxrMsgInScan(error_msg, iterator.awb, error_awbs_object, awb)
                    continue;
                }
                if (![0, 16, 17, 20, 21].includes(iterator.orderStatus)) {
                    if (iterator.route_request_assigned_id != route_request_assigned_id) {
                        let error_msg = `Not assigned to you`
                        await this.createErroxrMsgInScan(error_msg, iterator.awb, error_awbs_object, awb)
                        continue;
                    }
                }

                if ([0, 16, 17, 20, 21].includes(iterator.orderStatus)) {

                    if (sy_warehouse_id != iterator.sy_warehouse_id) {
                        let error_msg = `Not assigned to you`
                        await this.createErroxrMsgInScan(error_msg, iterator.awb, error_awbs_object, awb)
                        continue;
                    }
                    if (securePickupModes.includes(iterator.mode)) {
                        let error_msg = `Not assigned to you`
                        await this.createErroxrMsgInScan(error_msg, iterator.awb, error_awbs_object, awb)
                        continue;
                    }

                    non_manifested_arr.push(iterator);
                    non_manifested_order_ids.push(iterator.id)
                }

                if (securePickupModes.includes(iterator.mode)) {
                    let error_msg = `Not assigned to you`
                    await this.createErroxrMsgInScan(error_msg, iterator.awb, error_awbs_object, awb)
                    continue;
                }
                if (!EWAY_BILL_EXEMPT_MODES.includes(iterator.mode) && iterator.package_value >= 50000 && !iterator.eway_billno) {
                    // Check if the package value is greater than or equal to 50,000
                    // and if the eway bill number is not provided or is null

                    const error_msg = `Scan Failed - Order value more than 50,000 and ewaybill is not provided`;
                    // Create an error message indicating the scan failure reason

                    await this.createErroxrMsgInScan(error_msg, iterator.awb, error_awbs_object, awb);
                    // Call a function to create and store the error message in the scan

                    continue;
                    // Skip to the next iteration of the loop
                }

                picked_awbs.push(iterator)
                picked_order_ids.push(iterator.id)
            }

            if (awb_not_found.length) {
                let error_msg = `Orders not found`
                error_awbs_object[error_msg] = awb_not_found
            }

            if (picked_awbs.length) {

                await OrdersModel.updateOrderDetails(picked_order_ids, update_order_data);

                if (non_manifested_order_ids.length) {

                    await OrdersModel.updateOrderDetails(non_manifested_order_ids, { order_receive_date: new Date() });
                }

                await RouteAssignmentModel.updatePickupTripCount(route_request_assigned_id, picked_awbs.length)

                let event_obj = {};

                if (non_manifested_arr.length) {

                    event_obj['status'] = orderReceivedStatus;
                    event_obj['orders'] = non_manifested_arr;

                    await eventController.createEvent(event_obj); //Order received event

                    event_obj['status'] = orderAssigned;
                    event_obj['orders'] = non_manifested_arr;
                    event_obj['route_request_assigned_id'] = route_request_assigned_id;

                    await eventController.createEvent(event_obj); //rider assign event
                }

                event_obj['status'] = picked_order_status;
                event_obj['orders'] = picked_awbs;
                event_obj['route_request_assigned_id'] = route_request_assigned_id;

                await eventController.createEvent(event_obj);
            }

            for (let key in error_awbs_object) {
                let obj = {}
                obj[`title`] = key;
                obj[`data`] = error_awbs_object[key]

                error_awbs.push(obj)
            }
            let total_scan_awb = awb.length
            let pickedup_awbs_length = picked_awbs.length

            let complete_status = false; //default disable the button
            let trip_data = await RouteAssignmentModel.getPickupTripDataById(route_request_assigned_id);
            if (trip_data.length) {
                trip_data = trip_data[0]
                if (trip_data.picked_order_count > 0)
                    complete_status = true;
            }
            return { error_awbs, total_scan_awb, pickedup_awbs_length, complete_status };

        } catch (error) {
            console.error(error)
            throw Error(error.message)
        }
    }

    async createErroxrMsgInScan(msg, awb, error_awbs_object, awbs_arr) {

        const awb_reg = new RegExp(awb, "g");
        const original_awb = awbs_arr[awbs_arr.findIndex(value => awb_reg.test(value))]

        if (msg in error_awbs_object) {
            error_awbs_object[msg].push(original_awb || awb)
        } else {
            error_awbs_object[msg] = [original_awb || awb]
        }
    }

    async getOrdersTracking(id) {
        try {
            const [orderEvents, pickupData] = await Promise.all([
                OrdersModel.getOrdersTracking(id),
                PickupLocationModel.getPickupRiderData(id)
            ]);
            return { orderEvents, pickupData };
        }
        catch (exception) {
            console.error(exception)
            throw Error(exception)
        }
    }

    async getDeliveryOrdersTracking(id) {
        try {
            let result = await OrdersModel.getOrdersTracking(id);

            let deliveryRequestData = await OrderDeliveryModel.geDeliverRiderData(id)

            return { orderEvents: result, deliveryData: deliveryRequestData };
        }
        catch (exception) {
            console.error(exception)
            throw new Error(exception.message || exception)
        }
    }


    async checkWeatherAwbStatusForSecurePickup({ awb, pickupRequestId, routeRequestAssignedId }) {
        try {
            const [orderDetails] = await OrdersModel.checkWhetherAwbExist(awb);
            if (!orderDetails) {
                throw new Error(`Order details not found for AWB ${awb}`);
            }

            const { route_request_assigned_id: assignedRouteRequestId, orderStatus } = orderDetails;
            if (routeRequestAssignedId !== assignedRouteRequestId) {
                throw new Error(`AWB ${awb} is not assigned to this pickup request`);
            }
            if (orderStatus !== 3) {
                throw new Error('Already pickud-up or not assigned')
            }

            const [routeRequestAssignedDetails] = await RouteAssignmentModel.getPickupTripDataById(assignedRouteRequestId);
            const { picked_order_count, assigned_order_count } = routeRequestAssignedDetails;
            let submitAndComplete = false;
            if ((picked_order_count + 1) >= assigned_order_count) submitAndComplete = true;
            return { submitAndComplete };
        } catch (error) {
            console.error(error)
            throw new Error(`${error.message}`);
        }
    }

    async updateSecurePickupItem({ awb, device_id, lat_long, pickup_request_id, route_request_assigned_id, sy_warehouse_id }) {
        try {
            const pickedStatus = 4;
            const [orderDetails] = await OrdersModel.checkWhetherAwbExist(awb);
            if (!orderDetails) {
                throw new Error(`Order details not found for AWB ${awb}`);
            }

            const { route_request_assigned_id: assignedRouteRequestId, orderStatus, id: orderId } = orderDetails;
            await OrdersModel.updateOrderDetails([orderId], { status: pickedStatus });
            await RouteAssignmentModel.updatePickupTripCount(assignedRouteRequestId, 1);

            const eventObj = {
                status: pickedStatus,
                orders: [orderDetails],
                route_request_assigned_id: assignedRouteRequestId
            };
            await eventController.createEvent(eventObj);

            let complete_status = false; // Default disable the button
            const [tripData] = await RouteAssignmentModel.getPickupTripDataById(route_request_assigned_id);
            if (tripData && tripData.picked_order_count > 0) {
                complete_status = true;
            }

            return { error_awbs: 0, total_scan_awb: 0, pickedup_awbs_length: 1, complete_status };
        } catch (error) {
            console.error(error);
            throw new Error(`${error.message}`);
        }
    }

    async uploadEwayBill({ eway_billno, eway_bill_img, eway_bill_img_type, id, shypmax_id }) {
        try {
            // Update order details by ID
            await OrdersModel.updateOrderDetails([id], { eway_billno });

            // Prepare data for document upload
            const uploadData = {
                file_name: eway_bill_img,
                file_type: eway_bill_img_type,
                key: `ewaybill/${shypmax_id}.${eway_bill_img_type}`
            }
            // Upload the document on s3
            uploadDocument(uploadData);

        } catch (exception) {
            console.error(exception);
            // Throw the error if any exception occurs
            throw exception;
        }
    }

    async editEwayBill({ eway_billno, eway_bill_img, eway_bill_img_type, id, shypmax_id }) {
        try {
            // Update order details by ID
            await OrdersModel.updateOrderDetails([id], { eway_billno });

            if(eway_bill_img && eway_bill_img_type){
                // Prepare data for document upload
                const uploadData = {
                    file_name: eway_bill_img,
                    file_type: eway_bill_img_type,
                    key: `ewaybill/${shypmax_id}.${eway_bill_img_type}`
                }
                // Upload the document on s3
                uploadDocument(uploadData);
            }

        } catch (exception) {
            console.error(exception);
            // Throw the error if any exception occurs
            throw exception;
        }
    }

    async getEwayBillById(shypmax_id) {
        try {
            const s3Module = new S3Module();
            // Create an instance of the S3_MODULE class for interacting with Amazon S3

            const key = await s3Module.findObject(`ewaybill/${shypmax_id}`);
            // Use the S3 instance to find the object/key in the "ewaybill" directory based on the specified `shypmax_id`
            // If an error occurs during the S3 operation, it will be caught and logged

            const ewayBillImage = key ? await s3Module.getFilePath(key) : "";
            // If a valid `key` is obtained from S3, update the `eway_bill_image` property of the `result` object
            // by calling `getFilePath` method of the S3 instance to retrieve the file path associated with the key
            // If `key` is falsy (null, undefined, etc.), set ewayBillImage to an empty string
            return { ewayBillImage };
            // Return the updated `result` object
        }
        catch (exception) {
            console.error(exception);
            throw exception;
        }
    }



}

module.exports = Orders;
