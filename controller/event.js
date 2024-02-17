const hubTrackingStatus = require('../../shyptrack-static/hub_tracking_status.json')
const ORDER_EVENT = require('../models/order_event')
const shypmaxJSON = require('../../shyptrack-static/shypmax.json')
const { pushTrackingToSns } = require('../modules/sendEventsToSNS')


class Event {
    async createEvent(eventDetails) {
        const {
            status = null,
            orders = [],
            current_location = null,
            delivery = false,
            route_request_assigned_id = null,
            remark = null,
        } = eventDetails;

        try {
            // If no remark is provided, fetch the remark from the tracking status JSON
            let remarks = remark;
            if (!remarks) {
                const remarkKey = Object.keys(hubTrackingStatus).find(
                    (key) => Number(hubTrackingStatus[key].status) === Number(status)
                );
                remarks = hubTrackingStatus[remarkKey]?.remark ?? '';
            }

            // Create an array of order events to be inserted into the database
            const statusToAddDelay = [3, 4, 5]
            const orderEventArr = orders.map(({ id, awb, shypmax_id, hub_id }) => {
                let eventCreatedAt = new Date();
                if (statusToAddDelay.includes(Number(status))) {
                    eventCreatedAt.setSeconds(
                        eventCreatedAt.getSeconds() + 2
                    ); // To resolve conflicts between riderAssign and order received event
                }
                const eventUpdatedAt = eventCreatedAt; // Currently created and updated are same time
                return [
                    id,
                    shypmax_id || awb,
                    current_location,
                    status,
                    remarks,
                    eventCreatedAt,
                    eventUpdatedAt,
                    route_request_assigned_id,
                    hub_id
                ];
            });

            // Insert the order events into the database
            const fieldNames = ["order_id", "awb", "current_location", "status", "remarks", "event_created_at", "event_updated_at", "route_request_assigned_id", "hub_id"];
            await ORDER_EVENT.insertOrderEvent(fieldNames, orderEventArr);

            /*
            Fire-and-forget operations: In some cases, you might not need to wait for the completion of an asynchronous operation. 
            For example, if you're sending analytics data or making non-critical API requests, 
            you can fire the operation and continue with the rest of the function without awaiting its resolution
            */
            this.pushOrderEventsToSNS(status, orders); // push events to sns asynchronously after all process done 
        } catch (error) {
            console.error(error);
        }
    }

    /**
   * Pushes order events to SNS if tracking push is enabled and the status is included in the list of events to push.
   * @param {number} status - The status of the order event.
   * @param {Array<Object>} eventData - An array of order event data.
   * @param {boolean} is_event - Indicates whether the eventData needs to be fetched from the database. in this case no need to fetch event from event table
   * @returns {Promise<boolean>} - A Promise that resolves to true if the push is successful, otherwise an error is thrown.
   */
    async pushOrderEventsToSNS(status, eventData = [], is_event = true) {
        try {
            // Get the configuration values from the shypmaxJSON object.
            const { EVENTS_TO_PUSH = [], TRACKING_PUSH_TO_SNS = false } = shypmaxJSON;

            // Check if tracking push is enabled and the status is included in the list of events to push.
            if (TRACKING_PUSH_TO_SNS && EVENTS_TO_PUSH.includes(Number(status))) {
                // If is_event is true, fetch the eventData from the database.
                if (is_event) {
                    const orderIds = eventData.map(({ id }) => id);
                    if (orderIds.length) {
                        eventData = await ORDER_EVENT.getOrderEventsByStatus(orderIds, EVENTS_TO_PUSH);
                    }
                }
                // Push the eventData to SNS.
                await pushTrackingToSns(eventData);
            }

            // Return true if the push is successful.
            return true;
        } catch (exception) {
            // Log any errors and re-throw the exception.
            console.error(exception);
        }
    }


}

module.exports = Event;
