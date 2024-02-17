"use strict";

const ORDERS_MODEL = require('../models/orders')
const EVENT_CONTROLLER = require('./event');
const { getPickupRequestDataByDBId, updatePickupRequest } = require('../models/pickup_request')
const UtilClass = require('./util');
const {ewaybill_exempt_modes : EWAY_BILL_EXEMPT_MODES} = require('../../shyptrack-static/stconfig.json');


const EVENT = new EVENT_CONTROLLER();
class Inscan {

    static DEFAULT_PAGE = 1;
    static DEFAULT_LIMIT = 25;

    async inScan({ awb, hub_id }) {
        try {
            // Throw an error if AWB number is not provided
            if (!awb) {
                throw new Error('Please provide AWB number');
            }

            // Create an instance of the UtilClass
            const util = new UtilClass()

            // Trim the AWB number and check whether the order exists for the given AWB number
            awb = awb.trim();
            const [orderDetails] = await ORDERS_MODEL.checkWhetherAwbExist(awb);

            // Throw an error if no order is found for the given AWB number
            if (!orderDetails) {
                throw new Error(`No order found for AWB (${awb})`);
            }

            // Destructure orderDetails object to get required properties
            const { id, hub_id: orderHubId, orderStatus: status, pickup_request_id, dropoff_hub_id, order_receive_date, pickup_delivery, eway_billno, package_value, mode : dbModeName } = orderDetails;

            if (pickup_delivery == 1) {
                // Check if the dropoff hub ID is defined
                if (dropoff_hub_id) {
                    // If it is defined, make sure it matches the selected hub ID
                    if (dropoff_hub_id !== hub_id) {
                        // If the dropoff hub ID doesn't match the selected hub ID, throw an error
                        throw new Error(`AWB (${awb}) doesn't belong to the selected hub. Please select the correct hub.`);
                    }
                } else {
                    // If the dropoff hub ID is not defined, check if the order hub ID matches the selected hub ID
                    if (orderHubId !== hub_id) {
                        // If the order hub ID doesn't match the selected hub ID, throw an error
                        throw new Error(`AWB (${awb}) doesn't belong to the selected hub. Please select the correct hub.`);
                    }
                }
            }

            // List of statuses that are eligible for in-scan
            const inScanEligibleStatuses = [1, 3, 4, 16, 17, 18, 0, 20, 21, 100];

            // Throw an error if the order has already been in-scanned or its status is not eligible for in-scan
            if (!inScanEligibleStatuses.includes(status)) {
                throw new Error('Order has already been in-scanned');
            }

            // If the drop-off hub ID is 20 (DELIGI_HUB), no E-way bill is required because it's the last hub before the order is departed via flight.
            // If the drop-off is at DELIGI_HUB and the package value is greater than or equal to Rs 50,000,
            // there should be no restriction at INSCAN for generating an E-way bill.
            if (!EWAY_BILL_EXEMPT_MODES.includes(dbModeName) && package_value >= 50000 && !eway_billno && dropoff_hub_id !== 20) {
                // Check if the package value is greater than or equal to 50,000
                // and if the eway bill number is not provided or is null

                throw new Error("Scan Failed - Order value more than 50,000 and ewaybill is not provided");
                // Throw an error with a message indicating the scan failure reason
            }


            // Get the current date and time for in-scan
            const inScanDate = new Date();

            // If for some reason the rider did not scan the order (via the rider app)
            // and the order is received at the hub (and in-scanned),
            // then update the order count in the pickup request
            if ([1, 3, 16, 17, 21, 0].includes(status)) {
                // Status 3: Rider assigned for pickup
                if (pickup_request_id) await util.decrementPendingOrderCountInPickupRequest(pickup_request_id);

                // Create an event for the pickup request
                await EVENT.createEvent({
                    status: 4,
                    orders: [orderDetails],
                    remark: 'Picked-up (hub)'
                });
            }

            // Update order status (if provided) for in-scan
            const updatedOrderDetails = await ORDERS_MODEL.updateOrderDetails([id], { status: 5, inscan_date: inScanDate, order_receive_date: order_receive_date || new Date(), inscan_hub_id: hub_id });
            // Create an event for the order in-scan
            const eventObj = {
                status: 5,
                orders: [orderDetails]
            };
            const createdOrderEvent = await EVENT.createEvent(eventObj);

            return { success: true, message: 'Order in-scanned at origin hub' };
        } catch (error) {
            console.error(error);
            throw error;
        }
    }




    async getInscanOrderList(user_id, page_no, offset_row, hub_id) {
        try {
            let hasNext = false, hasPrev = false;

            const page = parseInt(page_no ?? Inscan.DEFAULT_PAGE);
            let limit = parseInt(offset_row ?? Inscan.DEFAULT_LIMIT);

            const offset = (page - 1) * limit;

            let result = await ORDERS_MODEL.getInscanedOrderByHub(hub_id, offset, limit + 1);

            if (result.length == limit + 1)
                hasNext = true;

            if (page > 1)
                hasPrev = true;

            result = result.slice(0, limit);

            return { data: result, hasNext, hasPrev };

        } catch (exception) {
            throw new Error(exception.message || exception)
        }
    }
}

module.exports = Inscan;