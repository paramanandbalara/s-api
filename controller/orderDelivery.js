
"use strict";

const DELIVERY_MODEL = require('../models/orderDelivery')
const ORDERS_MODEL = require("../models/orders")
const DELIVERY_REQUEST = require('../modules/pickupDeliveryRequest')
const ROUTE_ASSIGNMENT_MODEL = require('../models/routeAssignment')
const EVENT_CONTROLLER = require("./event")
const UTIL_CLASS = require('./util')
const UTIL = new UTIL_CLASS()
const dayjs = require('dayjs');
const DELIVERY_STATUS = ['', 'Rider Unassigned', 'Completed', 'Failed', 'Partial Delivery', 'Delivery Pending'];
const { getHubIdByUser } = require('../modules/userHub');
const OTP_GEN = require('../modules/gererateOtp')
const { sendOtp } = require('../modules/sendOtp');
const md5 = require('md5');
const PICKUP_VERIFY_MODEL = require('../models/pickupVerify')
const UPLOAD_DOCUMENT = require('../modules/uploadDocument');
const {getSettingDataByName} = require('../models/appSetting')




class OrderDelivery {
    /**
     * @type 1 for SHYPMAX RTO
     * @type 2 for Shypmax Import
    * @type 3 Importee / Shypmybox
    **/
    static DEFAULT_PAGE = 1;
    static DEFAULT_LIMIT = 25;
    static SCAN_AWB_LIMIT_COUNT = 100;

    async deliveryComplete(delivery_request_no, existing_route_request_assigned_id) {
        try {
            const update_data = { status_date: new Date() }; //status 4 for partial pickup

            const delivery_trip_data = await ROUTE_ASSIGNMENT_MODEL.getPickupTripDataById(existing_route_request_assigned_id);
            if (!delivery_trip_data.length) {
                throw new Error('Delivery trip not found')
            }

            const delivery_trip = delivery_trip_data[0]
            const { deliver_request_id: delivery_id } = delivery_trip

            const pending_orders = await ROUTE_ASSIGNMENT_MODEL.getDeliveryPendingOrders(delivery_id)

            const [delivery_request_data] = await ROUTE_ASSIGNMENT_MODEL.getDeliveryReuestDetailsBYDRNo(delivery_request_no);

            if (!delivery_request_data) {
                console.error('Delivery request not found.')
                return true;
            }
           
            let { delivery_location_id, hub_id, state } = delivery_request_data;

            const pending_order_count = pending_orders.length;
            
            if (delivery_request_data.pending_order_count === pending_order_count) {
                throw new Error("Delivery cannot be completed")
            }
            let delivery_req_state = 4;
            if (pending_order_count == 0) {
                delivery_req_state = 2; //for complete pickup
            }

            update_data.state = delivery_req_state;
            update_data.pending_order_count = pending_order_count;

            let result = await ROUTE_ASSIGNMENT_MODEL.updateDeliveryRequest(update_data, delivery_request_no);
            let reassign_pickup_request_id = null;
            if (pending_order_count > 0) {
                const deliveryReqData = { pending_orders, delivery_location_id, delivery_request_no, route_request_assigned_id: existing_route_request_assigned_id, hub_id }
                reassign_pickup_request_id = await this.updateOrderAndCreateDeliveryReq(deliveryReqData)
            }

            await ROUTE_ASSIGNMENT_MODEL.updateRouteRequest({ status: 1, reassign_pickup_request_id }, existing_route_request_assigned_id);

            return { data: result };
        }
        catch (exception) {
            console.error(exception)
            throw new Error(exception.message || exception);
        }
    }

    async updateOrderAndCreateDeliveryReq(data) {
        try {
            const { pending_orders, delivery_location_id, delivery_request_no, route_request_assigned_id: existing_route_request_assigned_id, hub_id } = data
            const order_ids = pending_orders.map(item => item.id);
            const delivery_pending_status = 104;

            const delivery_req_data = {
                delivery_location_id, hub_id, order_count: order_ids.length, delivery_request_no
            }

            const delivery_request = await DELIVERY_REQUEST.createDeliveryRequest(delivery_req_data)


            let { delivery_req_id, route_request_assigned_id } = delivery_request

            let update_order_data = {
                status: delivery_pending_status, deliver_request_id: delivery_req_id, route_request_assigned_id
            }

            if (route_request_assigned_id) {
                update_order_data.status = 101
            }

            await ORDERS_MODEL.updateOrderDetails(order_ids, update_order_data)

            const EVENT = new EVENT_CONTROLLER();

            let event_obj = {
                status: delivery_pending_status,
                orders: pending_orders,
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


    async updateRiderDeliveryScan(data) {
        try {
            let { awb, route_request_assigned_id } = data;
            if (!awb?.length) {
                throw new Error('awb not found')
            }

            if (!route_request_assigned_id) {
                throw new Error('Delivery trip not found')
            }
            const AWB_DETAILS = await UTIL.checkAwbExist(awb);
            const delivery_scan_status = 103;

            let awb_not_found = awb;

            let scanned_orders = [];
            let scanned_orders_ids = []
            const error_awbs_object = {}
            const error_awbs = []

            for (const iterator of AWB_DETAILS) {

                const awb_reg = new RegExp(iterator.awb, "g");
                awb_not_found = awb_not_found.filter(function (e) { return !awb_reg.test(e) })

                if (iterator.route_request_assigned_id != route_request_assigned_id) {
                    let error_msg = `AWB not found`;
                    await this.createErroxrMsgInScan(error_msg, iterator.awb, error_awbs_object, awb)
                    continue;
                }

                if ([103].includes(Number(iterator.orderStatus))) {
                    let error_msg = `Already Delivered`
                    await this.createErroxrMsgInScan(error_msg, iterator.awb, error_awbs_object, awb)
                    continue;
                }

                scanned_orders.push(iterator)
                scanned_orders_ids.push(iterator.id)
            }

            if (awb_not_found.length) {
                let error_msg = `Orders not found`
                error_awbs_object[error_msg] = awb_not_found
            }

            if (scanned_orders.length) {
                let update_order_data = {
                    status: delivery_scan_status,
                    route_request_assigned_id
                }

                await ORDERS_MODEL.updateOrderDetails(scanned_orders_ids, update_order_data);

                await ROUTE_ASSIGNMENT_MODEL.updateDeliverdOrderCount(route_request_assigned_id, scanned_orders.length)

                const EVENT = new EVENT_CONTROLLER();

                let event_obj = {
                    status: delivery_scan_status,
                    orders: scanned_orders,
                    delivery: true,
                    route_request_assigned_id
                };

                await EVENT.createEvent(event_obj);
            }

            for (let key in error_awbs_object) {
                let obj = {}
                obj[`title`] = key;
                obj[`data`] = error_awbs_object[key]

                error_awbs.push(obj)
            }
            let total_scan_awb = awb.length
            let delivered_orders_count = scanned_orders.length

            let complete_status = false; //default disable the button
            let trip_data = await ROUTE_ASSIGNMENT_MODEL.getPickupTripDataById(route_request_assigned_id);
            if (trip_data.length) {
                trip_data = trip_data[0]
                if (trip_data.deliver_order_count > 0)
                    complete_status = true;
            }

            return { error_awbs, total_scan_awb, delivered_orders_count, complete_status };

        } catch (exception) {
            console.error(exception)
            throw new Error(exception.message || exception)
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

    async assignDeliveryRider(delivery_request_no, rider_id, user_id) {
        if (!delivery_request_no?.length) {
            throw new Error('Delivery req number not found')
        }
        const eligble_status_for_assign = [100, 101, 104, 105, 11];
        const assign_order_status = 101;
        const hub_details = await getHubIdByUser(rider_id);

        const { hub_id } = hub_details;

        await UTIL.checkExistingRider("", hub_id, delivery_request_no);

        const delivery_request_data = await ROUTE_ASSIGNMENT_MODEL.getAllDeliveryRequests(delivery_request_no)

        for (const item of delivery_request_data) {
            const pickup_trip_data = {
                deliver_request_id: item.id,
                assigned_order_count: item.pending_order_count,
                rider_id: rider_id,
                status: 0,  // 0 for pending
                type: 2   // 1 for pickup
            }

            const orders = await ORDERS_MODEL.getOrderByDeliveryReqAndStatus(item.id, eligble_status_for_assign);

            if (orders.length && [1, 5].includes(item.state)) {
                const route_request_assigned_Details = await ROUTE_ASSIGNMENT_MODEL.openDeliveryTripsByPickupReq(item.id)
                if (route_request_assigned_Details.length) {
                    let route_req_details = route_request_assigned_Details[0];
                    const { id: route_req_id, deliver_order_count } = route_req_details
                    if (deliver_order_count) {
                        throw new Error(`You can't assign/re-assign, as already assigned rider has reached at location or pickup scan in-progress`)
                    }
                    await ROUTE_ASSIGNMENT_MODEL.updateRouteRequest({ rider_id: rider_id }, route_req_id);
                    await ROUTE_ASSIGNMENT_MODEL.updateDeliveryRequest({ rider_assigned_by: user_id }, item.delivery_request_no);
                    continue;
                }

                const route_request_assigned = await ROUTE_ASSIGNMENT_MODEL.savePickupTrips(pickup_trip_data);
                const route_request_assigned_id = route_request_assigned.insertId;

                const order_ids = orders.map(ele => ele.id)

                await ORDERS_MODEL.updateOrderDetails(order_ids, { status: assign_order_status, route_request_assigned_id })

                let result = await ROUTE_ASSIGNMENT_MODEL.updateDeliveryRequest({ state: 5, rider_assigned_by: user_id }, item.delivery_request_no);

                const EVENT = new EVENT_CONTROLLER();

                let event_obj = {
                    status: assign_order_status,
                    orders: orders,
                    delivery: true,
                    route_request_assigned_id
                };

                const create_order_event = await EVENT.createEvent(event_obj);
            } else {
                throw new Error(`You can't assign rider to delivery request ${item.delivery_request_no} as orders are already moved further.`)
            }
        }

        return true;
    }

    async getDeliveryTrips(filters, user_id, source) {
        let hasNext = false, hasPrev = false;
        const page = parseInt(filters?.page ?? OrderDelivery.DEFAULT_PAGE);
        let limit = parseInt(filters?.offset ?? OrderDelivery.DEFAULT_LIMIT);

        const offset = (page - 1) * limit;

        let delivery_trip_list = await ROUTE_ASSIGNMENT_MODEL.getDeliveryTrips(user_id, offset, limit + 1)

        const DELIVERY_STATUS = ['Delivery Pending', 'Completed', 'Failed'];

        delivery_trip_list.forEach(element => {
            // false means buttons are disabled and true means buttons are enabled

            if (element.status == 1) {
                element.complete_status = false;
                element.scan_status = false;
                element.reschedule_status = false;

                if (element.deliver_order_count == 0) {
                    element.status = 'Reschedule';
                }
                else {
                    element.status = 'Completed';
                }
            }
            else if (element.status == 0) {
                element.status = DELIVERY_STATUS[element.status];
                element.complete_status = true;
                element.scan_status = true;
                element.reschedule_status = true;

                if (element.deliver_order_count > 0) {
                    element.reschedule_status = false;
                }
                if (element.deliver_order_count == 0) {
                    element.complete_status = false;
                }
            }
        });

        if (delivery_trip_list.length == limit + 1)
            hasNext = true;

        if (page > 1)
            hasPrev = true;

        delivery_trip_list = delivery_trip_list.slice(0, limit);

        const scan_awb_limit_count = OrderDelivery.SCAN_AWB_LIMIT_COUNT;

        return { data: delivery_trip_list, hasNext, hasPrev, scan_awb_limit_count };
    }


    async getDeliveryRequestData({ page : pages, offset : offsets, startDate, endDate, state, pincodes, rider_id, status, delivery_request_no, hub_code, cities }, user_id) {
        try {

            let hasNext = false, hasPrev = false;
            const page = parseInt(pages ?? OrderDelivery.DEFAULT_PAGE);
            let limit = parseInt(offsets ?? OrderDelivery.DEFAULT_LIMIT);

            const offset = (page - 1) * limit;

            const data = {
                user_id,
                offset,
                limit: limit + 1,
                startDate,
                endDate,
                state,
                pincodes,
                rider_id,
                status,
                delivery_request_no,
                hub_code,
                cities
            }

            let delivery_request = await ROUTE_ASSIGNMENT_MODEL.getDeliveryRequestData(data);

            for (let element of delivery_request) {
                let rider_details = []

                rider_details = await ROUTE_ASSIGNMENT_MODEL.getRiderNameByPickupReq("", element.delivery_request_id);

                element.riderName = rider_details[0]?.name
                element.state_code = element.status;
                element.status = DELIVERY_STATUS[element.status];
            }

            if (delivery_request.length == limit + 1)
                hasNext = true;

            if (page > 1)
                hasPrev = true;

            delivery_request = delivery_request.slice(0, limit);
            return { data: delivery_request, hasNext, hasPrev };
        } catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async getDeliveryDetails(delivery_request_no, route_request_assigned_id, rider_id) {
        try {
			const settingName = ['delivery_via_otp', 'delivery_via_signature'];

            // Get the count of delivered AWBs for the specified route and rider
            let [deliveryreqAuthDetails] = await ORDERS_MODEL.getDeliveredAwbCount(route_request_assigned_id, rider_id);
            
            let is_auth = 0;
            let message = '';
			let otp_based = 0;
			let signature_based = 0;

            if (!deliveryreqAuthDetails) {
                return {message, is_auth};
            }

            const { hub_id : hubId } = deliveryreqAuthDetails

			const appSettingData = await getSettingDataByName(settingName);

            const {hub : hubOtp, user : userOtp, status : settingStatusOtp} = appSettingData[0] ||{}; 
            const {hub_id: hubListOtp = []} = hubOtp || {};
            const {user_id: userListOtp = []} = userOtp || {};


            const {hub : hubSign, user : userSign, status : settingStatusSign} = appSettingData[1] ||{}; 
            const {hub_id: hubListSign = []} = hubSign || {};
            const {user_id: userListSign = []} = userSign || {};

            if (settingStatusOtp !== 1 && settingStatusSign !== 1) {
				return { message: '', is_auth: 0 };
			}

            const otpCondition =
				settingStatusOtp === 1 &&
				(userListOtp.includes(0) ||
					hubListOtp.includes(0) ||
					userListOtp.includes(Number(rider_id)) ||
					hubListOtp.includes(Number(hubId)));
                    
            const signCondition =
                settingStatusSign === 1 &&
                (hubListSign.includes(0) ||
                    userListSign.includes(0) ||
                    hubListSign.includes(Number(hubId)) ||
                    userListSign.includes(Number(rider_id)));
            
            if (signCondition || otpCondition) {
                is_auth = 1;
            }
            if (signCondition || otpCondition) {
				is_auth = 1;
				if (otpCondition && signCondition) {
					otp_based = 1;
					signature_based = 1;
                    message = 'Package delivered confirmation through ';
				} else if (signCondition) {
					signature_based = 1;
					message = 'Package delivered confirmation through Signature';
				} else if (otpCondition) {
					otp_based = 1;
					message = 'Package delivered confirmation through OTP';
				} else {
					message = '';
				}
			}
    
            // Return the final object
            return {
				...deliveryreqAuthDetails,
				is_auth,
				message,
				signature_based,
				otp_based,
			};    
        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception)
        }
    }
    

    async sendVerifyOTP(req, res) {
        try {

            const rider_id = req.header('x-userid')

            const body = Object.assign({}, req.body);

            const { contact_number, delivered_awb_count, contact_name } = body;

            const otp = await OTP_GEN.generateOtp();

            await sendOtp(otp, contact_number, 'shyptrack_otp_login'); // todo temaplate no

            const otp_token = md5(Number(otp));

            res.append("otp_token", otp_token);

            return { success: true, message: `OTP sent` }

        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception)
        }
    }

    async verifyPickupOTP(otp_token, rider_id, body) {
        try {

            const { otp, deliver_request_id, delivered_awb_count, is_registered_number, otp_contact_name, otp_contact_number, delivery_request_no, is_auth, route_request_assigned_id } = body;

            let hub_data = await PICKUP_VERIFY_MODEL.getHubId(rider_id)

            const { hub_id, name } = hub_data?.[0] || {};

            if (is_auth) {
                if (!otp) {
                    throw new Error("OTP not found");
                }

                const encryptedOtp = md5(Number(otp));

                if (otp_token !== encryptedOtp) {
                    throw new Error('Please enter correct OTP')
                }

                const insertObj = {
                    request_id: deliver_request_id,
                    user_id: rider_id,
                    hub_id: hub_id,
                    awb_count: delivered_awb_count,
                    is_registered_number: is_registered_number,
                    otp_contact_number: otp_contact_number,
                    otp_contact_name: otp_contact_name,
                    otp_verifed_date: new Date(),
                    type: 2 // for delivery
                }

                await PICKUP_VERIFY_MODEL.savePickupVerifyOTP(insertObj)
            }

            await this.deliveryComplete(delivery_request_no, route_request_assigned_id)

            // const emailBody = { pickup_request_id, pickup_request_no, pickup_awb_count, name }

            // this.sendSellerEmail(emailBody)

            return true;
        }
        catch (exception) {
            console.error(exception)
            throw new Error(exception.message || exception)
        }
    }

    async verifySignature(body) {
        try {
            const { delivery_request_no, signature, signature_type, is_auth, route_request_assigned_id, deliver_request_id, sign_name, rider_id, delivered_awb_count } = body;
            
            let hub_data = await PICKUP_VERIFY_MODEL.getHubId(rider_id)

            const { hub_id } = hub_data?.[0] || {};

            if (is_auth) {

                if (signature && signature_type) {

                    const upload_data = {
                        file_name: signature,
                        file_type: signature_type,
                        key: `signature/delivery/${delivery_request_no}-${dayjs(new Date).format('YYYY-MM-DD')}.${signature_type}`
                    }

                    await UPLOAD_DOCUMENT.uploadDocument(upload_data)
                }

                const insertObj = {
                    request_id: deliver_request_id,
                    user_id: rider_id,
                    hub_id,
                    awb_count: delivered_awb_count,
                    otp_verifed_date: new Date(),
                    type: 2, // for delivery
                    signature_by_name : sign_name // to do check for name when feature is live for app
                }

                await PICKUP_VERIFY_MODEL.savePickupVerifyOTP(insertObj)
            }
            await this.deliveryComplete(delivery_request_no, route_request_assigned_id);

            return true;

        } catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async getTripCountByRiderId(rider_id, type) {
        try {
            let result = await DELIVERY_MODEL.getTripCountByRiderId(rider_id, type);
            if (result.length)
                return result[0]

            else return { count: 0 }

        } catch (exception) {
            throw new Error(exception.message || exception)
        }
    }
}

module.exports = OrderDelivery;
