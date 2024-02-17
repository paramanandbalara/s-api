"use strict"

const jwt = require('jsonwebtoken');
const ORDERS_MODEL = require('../models/orders');
const PICKUP_REQUEST_MODEL = require('../models/pickup_request')
const { getPickupRequestDataByDBId, updatePickupRequest, updatePickupRequestCount } = require('../models/pickup_request')

class UtilClass {

    async generateToken(payload, secretKey, expireTime) {
        try {
            const token = jwt.sign(payload, secretKey, { expiresIn: expireTime })
            return token;
        } catch (exception) {
            throw new Error(exception.message)
        }

    }


    async checkAwbExist(awb_arr) {
        try {
            const trimmedAwbArray = [];
            awb_arr.forEach(element => {
                element = element.trim();
                trimmedAwbArray.push(
                    element,
                    element.slice(8),
                    element.substr(element.length - 12),
                    element.substr(element.length - 23));
            });

            const awb_details = await ORDERS_MODEL.checkWhetherAwbExistForTracking(trimmedAwbArray);

            return awb_details
        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception)
        }
    }

    async checkExistingRider(pickup_request_no, hub_id, delivery_request_no) {
        try {
            let result = await PICKUP_REQUEST_MODEL.checkExistingRider(pickup_request_no, delivery_request_no);
            let pickup_ids = []

            if (result.length) {

                let completed_pickup_request = []

                let hubIdsAssociatedToPickupReq = []

                result.forEach(item => {
                    if (item.state == 2) completed_pickup_request.push(item.pickup_request_id)
                    pickup_ids.push(item.pickup_request_id)
                    hubIdsAssociatedToPickupReq.push(item.hub_id)
                });

                if (!pickup_ids.length) {
                    throw new Error('No request ids found')
                }

                if (completed_pickup_request.length) {
                    throw new Error(`Please deselect request for which status is "completed" in order to assign riders against pickup numbers for which status is "open".`)
                }

                if (!hubIdsAssociatedToPickupReq.length) {
                    throw new Error('No hubs found associated to requests')
                }

                hubIdsAssociatedToPickupReq = new Set(hubIdsAssociatedToPickupReq)
                hubIdsAssociatedToPickupReq = [...hubIdsAssociatedToPickupReq]

                if (!hubIdsAssociatedToPickupReq.includes(hub_id)) {
                    throw new Error("Selected rider cannot be assigned to orders related to different hub")
                }
            }

        }
        catch (exception) {
            console.error(exception)
            throw new Error(exception.message || exception);
        }
    }

    async decrementPendingOrderCountInPickupRequest(pickupRequestId) {
        if (!pickupRequestId) {
            throw new Error('pickupRequestId is required');
        }

        try {
            await updatePickupRequestCount(-1, pickupRequestId)
            return true;
        }
        catch (exception) {
            console.error(exception)
            throw new Error(exception.message || exception);
        }
    }


}

module.exports = UtilClass;