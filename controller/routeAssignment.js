'use strict';

const routeAssignmentModel = require('../models/routeAssignment')
const os = require('os');
const S3_MODULE = require('../modules/s3')
const dayjs = require('dayjs');
const { es6viewsParser, appendEs6FileOnHtml, getSlipHtmlToPDF } = require('../modules/htmlFunction');
const hub_tracking_status = require('../../shyptrack-static/hub_tracking_status.json')
const pickupRequestModel = require('../models/pickup_request')
const deliveryModel = require('../models/orderDelivery');
const ordersModel = require('../models/orders')
const STATUS = ['', 'Rider Unassigned', 'Completed', 'Failed', 'Partial Pickup', 'Pickup Pending', 'Auto Closed'];
const STATUS_DELIVERY = ['', 'Rider Unassigned', 'Completed', 'Failed', 'Partial Delivery', 'Delivery Pending', 'Auto Closed'];
const appSettingModel = require('../models/appSetting');

class RouteAssignment {

    static DEFAULT_PAGE = 1;
    static DEFAULT_LIMIT = 25;
    static SCAN_AWB_LIMIT_COUNT = 100;
    static SETTING_NAME = 'mobile_number_masking';

    async getRiders(user_id) {
        try {
            return routeAssignmentModel.getRiders(user_id);
        } catch (exception) {
            throw new Error(exception.message || exception)

        }
    }


    async getPickupRequestsList({ user_id, page_no, offset_row, startDate, endDate, pickup_state, status, rider_id, sy_warehouse_id, pincodes, pickup_request_no, hub_code, city }) {
        try {
            const page = parseInt(page_no ?? RouteAssignment.DEFAULT_PAGE);
            const limit = parseInt(offset_row ?? RouteAssignment.DEFAULT_LIMIT);
            const offset = (page - 1) * limit;

            const data = {
                user_id,
                offset,
                limit: limit + 1,
                startDate,
                endDate,
                pickup_state,
                status: Number(status),
                rider_id,
                sy_warehouse_id,
                pincodes,
                pickup_request_no,
                hub_code,
                city,
            };

            const pickupRequests = await routeAssignmentModel.getPickupRequestsList(data);

            const { routeRequestIds, pickupRequestIds } = this.extractRequestIds(pickupRequests);
            const checkIsFBAProOrderExistInPickupRequestPromise = pickupRequestIds.length ? routeAssignmentModel.checkOrderModeExistInPickupRequest(pickupRequestIds, 'FBA Pro') : [];

            const totalWeightInPickupRequestsPromise = pickupRequestIds.length ? routeAssignmentModel.getTotalWeightByPickupRequest(pickupRequestIds) : [];

            const overageOrdersPromise = routeRequestIds.length ? routeAssignmentModel.getOverAgeCountByRRAid(routeRequestIds) : [];

            const [
                checkIsFBAProOrderExistInPickupRequest,
                totalWeightInPickupRequests,
                overageOrders
            ] = await Promise.all([
                checkIsFBAProOrderExistInPickupRequestPromise,
                totalWeightInPickupRequestsPromise,
                overageOrdersPromise
            ]);

            let pickupRequestList = this.addOverageOrderCount(pickupRequests, overageOrders);
            
            pickupRequestList = this.addIsFbaPro(pickupRequestList, checkIsFBAProOrderExistInPickupRequest);

            pickupRequestList = this.addTotalWeight(pickupRequestList, totalWeightInPickupRequests);


            return { hasNext: pickupRequestList.length == limit + 1, hasPrev: page > 1, data: pickupRequestList };
        } catch (exception) {
            // Handle any exceptions
            throw exception;
        }
    }

    extractRequestIds(pickupRequests) {
        // Extract routeRequestIds and pickupRequestIds from pickupRequests using reduce
        const { routeRequestIds, pickupRequestIds } = pickupRequests.reduce(
            (result, { route_request_assigned_id, pickup_request_id }) => {
                if (route_request_assigned_id) {
                    result.routeRequestIds.push(route_request_assigned_id);
                }
                result.pickupRequestIds.push(pickup_request_id);
                return result;
            },
            { routeRequestIds: [], pickupRequestIds: [] }
        );

        return { routeRequestIds, pickupRequestIds };
    }

    addOverageOrderCount(pickupRequests, overageOrders) {
        // Add overage_order_count to each pickup request
        return pickupRequests.map(obj1 => {
            const matchingObj2 = overageOrders.find(obj2 => obj2.route_request_assigned_id === obj1.route_request_assigned_id);
            return {
                ...obj1,
                overage_order_count: matchingObj2 ? matchingObj2.overage_order_count : 0,
            };
        });
    }


    /**
  * Adds total weight to pickup requests based on their state code.
  * @param {Array} pickupRequests - The array of pickup requests.
  * @param {Array} totalWeightInPickupRequests - The array containing total weight for pickup requests.
  * @returns {Array} - The modified pickup requests array with total weight.
  */
    addTotalWeight(pickupRequests, totalWeightInPickupRequests) {
        return pickupRequests.map(obj1 => {
            // Only show weight for assigned and pickup pending requests (state_code: 1 and 5)
            if ([1, 5].includes(obj1.state_code)) {
                const matchingObj2 = totalWeightInPickupRequests.find(obj2 => obj2.pickup_request_id === obj1.pickup_request_id);
                return {
                    ...obj1,
                    totalWeight: matchingObj2 ? matchingObj2.totalWeight : 0,
                };
            }
            return obj1; // Return the original object if the state code doesn't match
        });
    }


    addIsFbaPro(pickupRequests, fbaProOrders) {
        // Add isFbaPro to each pickup request
        return pickupRequests.map(obj1 => {
            //pickup request state if state includes [2, 3, 4, 6] then disable rider  assign to pickup requests
            obj1.state_code = Number(obj1.status);
            const isPickupPendingStatus = Number(obj1.status) === 5;
            const isAutoAssigned = !obj1.rider_assigned_by;
            if (isPickupPendingStatus && isAutoAssigned) {
              obj1.status = `${STATUS[obj1.status]} (Auto)`;
            } else {
              obj1.status = STATUS[obj1.status];
            }

            const matchingObj2 = fbaProOrders.find(obj2 => obj2.pickup_request_id === obj1.pickup_request_id);
            return {
                ...obj1,
                isFbaPro: matchingObj2 ? true : false,
            };
        });
    }


    async generatePdf(rider_id) {
        try {

            let s3 = new S3_MODULE();

            let orders = await routeAssignmentModel.getPickupRequestDataForPRS(rider_id); // get pickup request data for pickup run sheet

            if (!orders.length) {
                throw new Error("No data found");
            }

            const es6_path = __dirname + '/../views/rider_pdf.es6';

            const html_path = `${os.tmpdir()}/shyptrack/rider_pdf.html`;

            const file_path = `${os.tmpdir()}/shyptrack/pickup-run-sheet/${orders[0].riderName}_${dayjs(new Date()).format('DD-MM-YYYY')}.pdf`

            const html_data = await es6viewsParser(es6_path, { orders });

            const get_html = await appendEs6FileOnHtml(html_path, html_data);

            const generate_pdf = await getSlipHtmlToPDF(html_path, file_path);

            const key = `pickup-run-sheet/${orders[0].riderName}_${dayjs(new Date()).format('DD-MM-YYYY')}.pdf`

            await s3.uploadToS3(null, key, file_path);

            let filepath = await s3.getFilePath(key);

            return filepath
        }
        catch (exception) {
            throw new Error(exception.message || exception);
        }
    }

    async getPickupRequestsData(hub_id) {
        try {
            let result = await routeAssignmentModel.getPickupRequestsByHubId(hub_id);
            if (!result.length) {
                throw new Error("No Data Found")
            }
            return result;
        }
        catch (exception) {
            throw new Error(exception.message || exception);
        }
    }


    async getPickupTrips(userId, page_no, offset_row) {
        // Set default values for page and limit if not provided
        const page = parseInt(page_no) || RouteAssignment.DEFAULT_PAGE;
        const limit = parseInt(offset_row) || RouteAssignment.DEFAULT_LIMIT;

        // Calculate the offset based on the page and limit
        const offset = (page - 1) * limit;

        // Retrieve the list of pickup trips with the specified userId, offset, and limit
        const pickupTripList = await routeAssignmentModel.getPickupTrips(
            userId,
            offset,
            limit + 1,
        );

        const { hub_id : hubId } = pickupTripList[0];

        // Retrieve the active IVR rider list
        const [activeIvrRiderList] = await appSettingModel.getSettingDataByName(RouteAssignment.SETTING_NAME);

        const isIvr = this.validateIvrData(userId, hubId, activeIvrRiderList);

        // Define status labels
        const STATUS = ['Pickup Pending', 'Completed', 'Failed'];

        // Map and modify each pickup trip element
        const mappedPickupTrips = pickupTripList.map((element) => {
            let status, complete_status, scan_status, reschedule_status;

            // false means buttons are disabled and true means buttons are enabled
            if (element.status === 1) {
                complete_status = false;
                scan_status = false;
                reschedule_status = false;
                status = element.picked_order_count === 0 ? 'Reschedule' : 'Completed';
            } else if (element.status === 0) { 
                status = STATUS[element.status];
                complete_status = true;
                scan_status = true;
                reschedule_status = true;

                if (element.picked_order_count > 0) {
                    reschedule_status = false;
                }
                if (element.picked_order_count === 0) {
                    complete_status = false;
                }
            }

            // Return modified element with additional properties
            return {
                ...element,
                isIvr,
                status,
                complete_status,
                scan_status,
                reschedule_status,
            };
        });

        // Check if there are more pickup trips available for the next page
        const hasNext = pickupTripList.length > limit;

        // Check if there is a previous page
        const hasPrev = page > 1;

        // Define the scan AWB limit count
        const scan_awb_limit_count = RouteAssignment.SCAN_AWB_LIMIT_COUNT;

        // Return the result
        return {
            data: mappedPickupTrips.slice(0, limit), // Slice the mappedPickupTrips to match the requested limit
            hasNext,
            hasPrev,
            scan_awb_limit_count,
        };
    }

    validateIvrData(userId, hubId, activeIvrRiderList) {
        // Extracting the 'hubId' and 'userId' from the 'activeIvrRiderList' object
        // and assigning them to variables 'hubList' and 'userList' respectively.
        // If 'activeIvrRiderList' is null or undefined, default empty arrays are assigned to 'hubList' and 'userList'.
        const {
            hub: { hub_id: hubList = [] } = {},
            user: { user_id: userList = [] } = {},
            status : settingStatusIvr
          } = activeIvrRiderList || {};

        // Checking if 'hubId' exists in 'hubList' array or 'userId' exists in 'userList' array.
        // The 'hubList.includes(hubId)' checks if 'hubId' is present in 'hubList' array.
        // The 'userList.includes(Number(userId))' checks if 'userId' (converted to a number) is present in 'userList' array.
        // If either condition is true, the result will be true. Otherwise, it will be false.
        return (settingStatusIvr === 1 )&& (hubList.includes(0) || hubList.includes(hubId) || userList.includes(0) || userList.includes(Number(userId)));
    }


    /**
 * Retrieves pickup requests timeline for a given pickup request ID, page number and offset
 * @param {string} pickupRequestId - The ID of the pickup request
 * @param {number} pageNumber - The page number to retrieve (default: RouteAssignment.DEFAULT_PAGE)
 * @param {number} limit - The maximum number of results to retrieve (default: RouteAssignment.DEFAULT_LIMIT)
 * @returns {Promise} - A Promise that resolves to the pickup requests timeline
 * @throws {Error} - If pickupRequestId is missing
 */
    async getPickupRequestsTimeline(pickupRequestId, pageNumber = RouteAssignment.DEFAULT_PAGE, limit = RouteAssignment.DEFAULT_LIMIT) {
        // Check that the pickupRequestId is provided
        if (!pickupRequestId) {
            throw new Error("Pickup request ID is missing");
        }

        try {

            const offsets = (pageNumber - 1) * limit;
            limit = Number(limit)

            // Get pickup requests timeline from order event
            let pickupRequestsTimeline = [];
            pickupRequestsTimeline = await routeAssignmentModel.getPickupRequestsTimelineFromOrderEvent(pickupRequestId, offsets, limit + 1);

            // If no results are found, get pickup requests timeline
            const pickupRequestData = await pickupRequestModel.getRouteReqAndPickupReqByPickuRequestid(pickupRequestId)
            const { manifested_orders_count = 0, assigned_order_count = 0 } = pickupRequestData[0]
            let dataFetchedFromOrders = false
            if (!pickupRequestsTimeline.length) {
                dataFetchedFromOrders = true
                pickupRequestsTimeline = await routeAssignmentModel.getPickupRequestsTimeline(pickupRequestId, offsets, limit + 1);
            }
            if ((!pickupRequestsTimeline.length || pickupRequestsTimeline.length == 25) || manifested_orders_count !== assigned_order_count && !dataFetchedFromOrders) {
                const ordersNotInRRA = await routeAssignmentModel.getPickupRequestsTimeline(pickupRequestId, offsets, limit + 1);
                pickupRequestsTimeline = [...pickupRequestsTimeline, ...ordersNotInRRA]
            }

            // Update each pickup request with the corresponding state from the hub tracking status
            if (pickupRequestsTimeline.length) {
                pickupRequestsTimeline.forEach((item) => {
                    const { status } = item;
                    const statusKey = Object.keys(hub_tracking_status).find((key) => hub_tracking_status[key]['status'] == status);
                    if (statusKey) item.state = hub_tracking_status[statusKey]['remark'];
                });
            }

            const result = await this.paginationFun(pickupRequestsTimeline, limit, pageNumber);
            return result;
        } catch (exception) {
            console.log(__line, exception);
            throw new Error(exception.message || exception);
        }
    }


    async getDeliveryRequestsTimeline(delivery_request_no, page, offset, deliver_request_id) {
        try {
            const page_no = parseInt(page ?? RouteAssignment.DEFAULT_PAGE);

            let limit = parseInt(offset ?? RouteAssignment.DEFAULT_LIMIT);

            const offsets = (page_no - 1) * limit;
            if (!deliver_request_id) {
                const delivery_req_details = await deliveryModel.getDeliveryRequestId(delivery_request_no)
                deliver_request_id = delivery_req_details[0]?.id;
            }

            let data = await routeAssignmentModel.getDeliveryRequestTimelineFromOrderEvent(deliver_request_id, offsets, limit + 1);

            if (!data.length) {
                data = await routeAssignmentModel.getDeliveryRequestsTimeline(deliver_request_id, offsets, limit + 1);
                data.forEach(item => {
                    const status = Object.keys(hub_tracking_status).find(key => hub_tracking_status[key][`status`] == item[`status`]);
                    item.state = hub_tracking_status[status][`remark`]
                });
            }
            let result = await this.paginationFun(data, limit, page_no)

            return result;
        }
        catch (exception) {
            console.log(__line, exception)
            throw new Error(exception.message || exception);
        }
    }

    /**
  * Paginates an array of data and returns an object with the paginated data and flags indicating whether there is a next or previous page.
  * @param {Array} data - The data to be paginated.
  * @param {Number} limit - The maximum number of items to show on each page.
  * @param {Number} page_no - The current page number.
  * @returns {Object} An object with the paginated data and flags indicating whether there is a next or previous page.
  */
    async paginationFun(data, limit, page_no) {
        try {
            // Initialize flags indicating whether there is a next or previous page.
            let hasNext = false, hasPrev = false;

            // Check if there are more items to show on the next page.
            if (data.length == limit + 1)
                hasNext = true;

            // Check if there are any previous pages to go back to.
            if (page_no > 1)
                hasPrev = true;

            // Return an object with the paginated data and the flags indicating whether there is a next or previous page.
            return { data, hasNext, hasPrev };
        } catch (exception) {
            // Log any errors that occur during the pagination process and re-throw them.
            console.error(exception);
            throw new Error(exception.message || exception);
        }
    }

    async generateDeliveryPdf(rider_id) {
        try {

            let s3 = new S3_MODULE();

            let orders = await routeAssignmentModel.getDeliveryRequestDataForDRS(rider_id);  // get pickup request data for pickup run sheet

            if (!orders.length) {
                throw new Error("No data found");
            }

            let deliveryReqID = orders.map(({ deliver_req_id }) => deliver_req_id)

            let awb_arr = []

            const awbByDeliveryReqId = await routeAssignmentModel.getAwbsByDelReqId(deliveryReqID)

            orders.map(i => {
                awbByDeliveryReqId.map(({ deliver_request_id, awb }) => {
                    if (i.deliver_req_id === deliver_request_id) {
                        awb_arr.push(awb);
                    }
                })
                i.awb = awb_arr
                awb_arr = []
            })

            const es6_path = __dirname + '/../views/delivery_pdf.es6';

            const html_path = `${os.tmpdir()}/shyptrack/delivery_pdf.html`;

            const file_path = `${os.tmpdir()}/shyptrack/delivery-run-sheet/${orders[0].riderName}_${dayjs(new Date()).format('DD-MM-YYYY')}.pdf`

            const html_data = await es6viewsParser(es6_path, { orders });

            const get_html = await appendEs6FileOnHtml(html_path, html_data);

            const generate_pdf = await getSlipHtmlToPDF(html_path, file_path);

            const key = `pickup-run-sheet/${orders[0].riderName}_${dayjs(new Date()).format('DD-MM-YYYY')}.pdf`

            await s3.uploadToS3(null, key, file_path);

            let filepath = await s3.getFilePath(key);

            return filepath
        }
        catch (exception) {
            throw new Error(exception.message || exception);
        }
    }

    async arrayToObject(arr, key) {
        const obj = {};
        for (let item of arr) {
            if (obj[item[key]] === undefined) {
                obj[item[key]] = [];
            }
            obj[item[key]].push(item);
        }
        return obj;
    }

    /**
  * Retrieves pickup request details based on the provided pickup_request_id.
  * @param {string} pickup_request_id - The ID of the pickup request.
  * @returns {Promise<Object>} The pickup request details.
  * @throws {Error} If the pickup_request_id is missing or the pickup request cannot be found.
  */

    async getPickupRequestDetails(pickup_request_id) {
        // Check that the pickup_request_id is provided
        if (!pickup_request_id) {
            throw new Error("Pickup request ID is missing");
        }

        try {
            // Get the pickup request details
            const pickupRequestDetails = await routeAssignmentModel.getPickupRequestDetailById(pickup_request_id);

            // If no pickup request is found, throw an error
            if (!pickupRequestDetails.length) {
                throw new Error('Pickup request not found')
            }

            // Extract the pickup request creation date and AWBs from the results
            const { pickup_request_created } = pickupRequestDetails[0];
            const awbs = pickupRequestDetails.map(item => item.awb)
            // Get the pickup requests that are assigned to the same route request as the current request
            const nextAssignPickupRequests = await routeAssignmentModel.getReassignPickupRequestDetails(awbs, pickup_request_created)

            // Combine the current and next assigned pickup requests
            let result = [pickupRequestDetails[0], ...nextAssignPickupRequests]

            // Get the route request IDs for the combined list of pickup requests
            const route_req_ids = result
                .filter(({ route_request_assigned_id }) => {
                    // Only include items in the result array that have a route_request_assigned_id value
                    return !!route_request_assigned_id;
                })
                .map(({ route_request_assigned_id }) => route_request_assigned_id);


            // If there are assigned route requests, get the count of overage orders for each one
            let overage_orders = []
            if (route_req_ids.length) {
                overage_orders = await routeAssignmentModel.getOverAgeCountByRRAid(route_req_ids)
            }
            // Map over the results to add the overage order count and convert the status code to a string
            result = result.map(obj1 => {
                const isPickupPendingStatus = Number(obj1.status) === 5;
                const isAutoAssigned = !obj1.rider_assigned_by;
                if (isPickupPendingStatus && isAutoAssigned) {
                  obj1.status = `${STATUS[obj1.status]} (Auto)`;
                } else {
                  obj1.status = STATUS[obj1.status];
                }

                const matchingObj2 = overage_orders.find(obj2 => obj2.route_request_assigned_id === obj1.route_request_assigned_id);
                return {
                    ...obj1,
                    overage_order_count: matchingObj2 ? matchingObj2.overage_order_count : 0
                };
            });
            return result;
        } catch (error) {
            // Log and throw any errors that occur
            console.error(error);
            throw new Error(error.message || "Error retrieving pickup request details");
        }
    }

    async getWareHouseAndPrDetailsByPrId(pickup_request_id) {
        // Check that the pickup_request_id is provided
        if (!pickup_request_id) {
            throw new Error("Pickup request ID is missing");
        }

        try {
            const [result] = await routeAssignmentModel.getWareHouseAndPrDetailsByPrId(pickup_request_id)
            if (result) {
                const { status, route_request_assigned_id } = result

                if (![3, 4].includes(Number(status))) {
                    result.failed_orders = 0; //3, 4 means partial pickup or failed other wise failed order count will be 0
                    result.total_weight = (await ordersModel.getTotalWeightByPR(pickup_request_id))[0]['totalWeight']
                }
                else result.total_weight = (await ordersModel.getTotalWeightByRRA(route_request_assigned_id))[0]['totalWeight']

                result.status = STATUS[status]
            }
            return [result];
        } catch (error) {
            // Log and throw any errors that occur
            console.error(error);
            throw new Error(error.message || "Error retrieving pickup request details");
        }
    }

    async getDeliveryRequestDetails(delivery_request_id) {
        if (!delivery_request_id) {
            throw new Error("Delivey request ID is missing");
        }
        try {
            const deliveryRequestDetails = await routeAssignmentModel.getDeliveyRequestDetailById(delivery_request_id);
            if (!deliveryRequestDetails.length) {
                throw new Error('Delivey request not found')
            }
            const { delivery_request_created } = deliveryRequestDetails[0];
            const awbs = deliveryRequestDetails.map(item => item.awb)
            const nextAssignDeliveyRequests = await routeAssignmentModel.getReassignDeliveyRequestDetails(awbs, delivery_request_created)
            const result = [deliveryRequestDetails[0], ...nextAssignDeliveyRequests]
            result.forEach(element => {
                element[`status`] = STATUS_DELIVERY[element[`status`]]
            })
            return result;

        } catch (error) {
            // Log and throw any errors that occur
            console.error(error);
            throw new Error(error.message || "Error retrieving delivey request details");
        }
    }

    async getDeliveyRequestsTimeline(deliveryRequestId, pageNumber = RouteAssignment.DEFAULT_PAGE, limit = RouteAssignment.DEFAULT_LIMIT) {
        // Check that the deliveryRequestId is provided
        if (!deliveryRequestId) {
            throw new Error("Delivery request ID is missing");
        }

        try {

            const offsets = (pageNumber - 1) * limit;
            limit = Number(limit)

            // Get Delivery requests timeline from order event
            let deliveryRequestsTimeline = await routeAssignmentModel.getDeliveryRequestsTimelineFromOrderEvent(deliveryRequestId, offsets, limit + 1);

            if (!deliveryRequestsTimeline.length) {
                deliveryRequestsTimeline = await routeAssignmentModel.getDeliveryRequestsTimeline(deliveryRequestId, offsets, limit + 1);
            }

            // Update each Delivery request with the corresponding state from the hub tracking status
            if (deliveryRequestsTimeline.length) {
                deliveryRequestsTimeline.forEach((item) => {
                    const { status } = item;
                    const statusKey = Object.keys(hub_tracking_status).find((key) => hub_tracking_status[key]['status'] == status);
                    if (statusKey) item.state = hub_tracking_status[statusKey]['remark'];
                });
            }

            const result = await this.paginationFun(deliveryRequestsTimeline, limit, pageNumber);
            return result;
        } catch (exception) {
            console.log(__line, exception);
            throw new Error(exception.message || exception);
        }
    }

    async getWareHouseAndDeliveyDetails(deliveryRequestId) {
        if (!deliveryRequestId) {
            throw new Error("Delivery request ID is missing");
        }

        try {
            const result = await routeAssignmentModel.getWareHouseAndDeliveyDetails(deliveryRequestId)
            if (result.length) {
                const { status } = result[0]
                if (![3, 4].includes(Number(status))) result[0].failed_orders = 0; //3, 4 means partial pickup or failed other wise failed order count will be 0
                if (![2, 3, 4].includes(Number(status))) result[0].duration = null; //3, 4 means partial pickup or failed other wise failed order count will be 0
                result[0].status = STATUS[status]
            }
            return result;
        } catch (error) {
            // Log and throw any errors that occur
            console.error(error);
            throw new Error(error.message || "Error retrieving pickup request details");
        }
    }
}


module.exports = RouteAssignment;
