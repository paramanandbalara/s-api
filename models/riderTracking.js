'use strict';

/**
 * Get rider tracking data for the given rider IDs and date range
 * @param {Object} params - Function parameters
 * @param {Array} params.riderId - An array of rider IDs
 * @param {string} params.startDate - The start date of the date range in "YYYY-MM-DD" format
 * @param {string} params.endDate - The end date of the date range in "YYYY-MM-DD" format
 * @returns {Array} An array of objects representing the rider tracking data
 */
const getRiderTracking = async ({ riderId, startDate, endDate }) => {
    try {
        const query = `SELECT 
                            oe.route_request_assigned_id, 
                            oe.event_created_at, 
                            pl.contact_name, 
                            pl.company_name,
                            pl.address,
                            pl.city,
                            pl.state,
                            pl.pincode, 
                            rra.rider_id,
                            oe.awb,
                            oe.status
                        FROM 
                            order_event oe 
                            INNER JOIN route_request_assigned rra ON oe.route_request_assigned_id = rra.id 
                            LEFT JOIN pickup_request pr ON rra.pickup_request_id = pr.id 
                            LEFT JOIN pickup_location pl ON pr.pickup_location_id = pl.id 
                        WHERE 
                            rra.rider_id IN (?) 
                            AND oe.event_created_at BETWEEN ? AND ?
                            AND oe.status IN (4, 16);
                        `;
        const [rows] = await readDB.query(query, [riderId, startDate, endDate]);
        return rows;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

/**
 * Retrieves the details of riders who checked in between a given date range.
 *
 * @param {Object} params - The parameters for retrieving the rider checkin details.
 * @param {string} params.startDate - The start date for the search range.
 * @param {string} params.endDate - The end date for the search range.
 * @param {number} params.userId - The user ID of the hub.
 * @param {number|null} params.rider_id - (Optional) The rider ID to filter the results by.
 * @param {number} params.offset - The number of records to skip.
 * @param {number} params.limit - The maximum number of records to return.
 * @returns {Promise<Object>} - The list of riders and their checkin details.
 */
const getRiderCheckinDetails = async ({ startDate, endDate, userId, rider_id = null, offset, limit, hub_id }) => {
    try {
        const filter = [];
        let query = `
                      SELECT
                        U.id AS rider_id,
                        U.name,
                        RCC.checkin_date
                      FROM
                        user_hub UH
                        INNER JOIN users U ON U.id = UH.user_id
                        INNER JOIN rider_checkin_checkout RCC ON RCC.user_id = U.id
                      WHERE
                        U.role_id = 2
                    `;
        if (hub_id?.length) {
            query += ' AND UH.hub_id  IN (?) ';
            filter.push(hub_id);
        }

        if (startDate && endDate) {
            query += ` AND RCC.checkin_date BETWEEN ? AND ?`
            filter.push(startDate);
            filter.push(endDate);

        }

        if (rider_id) {
            query += 'AND RCC.user_id = ? ';
            filter.push(rider_id);
        }
        if (limit) {
            query += 'ORDER BY RCC.checkin_date ASC LIMIT ?, ?';
            filter.push(offset, limit);
        }

        const [rows] = await readDB.query(query, filter);
        return rows;
    } catch (error) {
        console.error(error);
        throw error;
    }

};


module.exports = {
    getRiderTracking,
    getRiderCheckinDetails
};
