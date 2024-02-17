"use strict";
const RiderTrackingModel = require('../models/riderTracking')
const RouteAssignmentModel = require('../models/routeAssignment')
const dayjs = require('dayjs')

class RiderTracking {
    static DEFAULT_PAGE = 1;
    static DEFAULT_LIMIT = 25;
    async getRiderTracking({ page: page_no, offset: offset_row, startDate, endDate, userId, rider_id, hub_id }) {
        try {
            // Initialize variables and set defaults
            let hasNext = false, hasPrev = false;
            let page = Number(page_no ?? RiderTracking.DEFAULT_PAGE);
            let limit = Number(offset_row ?? RiderTracking.DEFAULT_LIMIT);
            let offset = (page - 1) * limit;
            startDate = dayjs(startDate || new Date()).format('YYYY-MM-DD 00:00:00');
            endDate = dayjs(endDate || new Date()).format('YYYY-MM-DD 23:59:59');
            if (hub_id) {
                hub_id = hub_id.split(',')
            }
            if (!hub_id.length) {
                throw new Error(`Please select hub`)
            }
            // Get rider details and check-in information
            const riderDetails = await RiderTrackingModel.getRiderCheckinDetails({ startDate, endDate, userId, offset, limit: limit + 1, rider_id, hub_id })

            // Extract rider IDs from the details
            const riderIds = riderDetails.map(({ rider_id }) => rider_id)

            let riderTrackingData = []
            if (riderIds.length) {
                // Get rider tracking data for the given date range and rider IDs
                riderTrackingData = await RiderTrackingModel.getRiderTracking({ riderId: riderIds, startDate, endDate });
            }

            // Map rider details and tracking data together
            let result = this.mapTrackingWithRider(riderDetails, riderTrackingData)
            // Check if there is a next page of results
            if (result.length == limit + 1)
                hasNext = true;

            // Check if there is a previous page of results
            if (page > 1)
                hasPrev = true;

            // Slice the result to the specified limit
            result = result.slice(0, limit);

            // Return the result along with hasNext and hasPrev flags
            return { data: result, hasNext, hasPrev };
        } catch (error) {
            console.error(error);
            throw new Error(error.message);
        }
    }


    mapTrackingWithRider(riderDetails, riderTrackingData) {
        const result = riderDetails.map(({ rider_id, name, checkin_date: rider_checkin_time }) => {
            // Map over the riderDetails array to create a new array with transformed objects
            const rider_events = riderTrackingData.filter((dataObj) => dataObj.rider_id === rider_id);
            // Filter the riderTrackingData array to get only the objects for this rider
            return {
                id: rider_id,
                name,
                rider_checkin_time,
                rider_events,
            };
            // Return a new object with properties for the rider ID, name, check-in time, and rider events array
        });

        result.forEach((item) => {
            const trackingEvents = []; // Initialize an empty array to hold the tracking events for this item
            let prevEventCreatedAt = item.rider_checkin_time; // Initialize the previous event's created_at time to the rider check-in time
            let prevRouteRequestId; // Initialize the previous route request ID to undefined
            item.rider_events.forEach((event) => { // Loop through the rider events for this item
                const prevEvent = trackingEvents[trackingEvents.length - 1]; // Get the previous event from the tracking events array
                const { route_request_assigned_id, event_created_at, status } = event; // Destructure the event object to get the route request ID and created_at time
                const timeDiffMs = event_created_at - prevEventCreatedAt; // Calculate the time difference between the current event and the previous event
                const timeDiffSec = Math.floor(timeDiffMs / 1000); // Convert the time difference to seconds and round down
                const hours = Math.floor(timeDiffSec / 3600); // Calculate the number of hours in the time difference
                const minutes = Math.floor((timeDiffSec % 3600) / 60); // Calculate the number of minutes in the remaining seconds
                const time_taken = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`; // Set the time_taken property of the current event to the formatted time difference
                let success = false;
                if (route_request_assigned_id !== prevRouteRequestId) { // If the current event is for a different route request than the previous event
                    if (status === 4) {
                        success = true
                        event.count = 1; // Set the count property of the current event to 1
                    }
                    event.success = success
                    event.time_taken = time_taken
                    trackingEvents.push(event); // Add the current event to the tracking events array
                    prevRouteRequestId = route_request_assigned_id; // Update the previous route request ID to the current event's route request ID
                    prevEventCreatedAt = event_created_at; // Update the previous event's created_at time to the current event's created_at time
                } else if (status === 4){ // If the current event is for the same route request as the previous event
                    prevEvent.count += 1; // Increment the count property of the previous event
                }
            });
            item.rider_events = trackingEvents; // Replace the rider_events array for this item with the tracking events array
        });

        return result
    }

}

module.exports = RiderTracking;
