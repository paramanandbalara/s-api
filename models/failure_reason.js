"use strict";

const dayjs = require("dayjs");

const getFailureReason = async (type = 1) => {
    try {

        let sql = `SELECT id, failure_reason FROM failure_reason WHERE type = ?`;

        let [rows] = await readDB.query(sql, [type]);

        return rows;
        
    } catch (exception) {
        throw new Error(exception.message)
    }
}


const getFailedTrips = async (filters, user_id) => {
    try {
        let query = `SELECT  RRA.id route_request_id, U.name rider_name, PR.pickup_date, 
                    HD.code, HD.city, HD.name hub_name, PR.pickup_request_no, PR.status_date as status_date, PL.seller_id,
                    PL.address seller_address, FR.failure_reason
                    FROM route_request_assigned RRA
                    INNER JOIN pickup_request PR ON PR.id = RRA.pickup_request_id
                    INNER JOIN pickup_location PL ON PR.pickup_location_id = PL.id
                    INNER JOIN hub_details HD ON PR.hub_id = HD.id
                    LEFT JOIN users U on U.id = RRA.rider_id 
                    LEFT JOIN failure_reason FR ON RRA.failure_reason = FR.id
                    WHERE RRA.failure_reason IS NOT NULL  AND PR.hub_id IN  (SELECT hub_id from user_hub where user_id = ${user_id}) `
        
        if (filters?.startDate && filters?.endDate) {

            const dateStart = dayjs(filters?.startDate || new Date()).format('YYYY-MM-DD 00:00:00');
            const dateEnd = dayjs(filters?.endDate || new Date()).format('YYYY-MM-DD 23:59:59');

            query += ` AND PR.status_date >= '${dateStart}' AND PR.status_date <= '${dateEnd}'`;
        }

        query += ` ORDER BY PR.status_date DESC LIMIT ${filters.offset},${filters.limit}`
        
        let [rows] = await readDB.query(query, [filters?.offset, filters?.limit])

        return rows;
    } catch (exception) {
        console.error(exception.message || exception);
        throw new Error(exception.message || exception);
    }
}

const getFailedTripExportQuery = async (filters, user_id) => {
    try {
        let query = `SELECT  RRA.id route_request_id, FR.failure_reason, U.name rider_name, PR.pickup_date, 
                    HD.code, HD.city, HD.name hub_name, PR.pickup_request_no,
                    PL.address seller_address, O.manifest_id, PR.status_date as status_date, PL.seller_id
                    FROM route_request_assigned RRA
                    INNER JOIN pickup_request PR ON PR.id = RRA.pickup_request_id
                    LEFT JOIN orders O ON O.route_request_assigned_id = RRA.id
                    INNER JOIN pickup_location PL ON PR.pickup_location_id = PL.id
                    INNER JOIN hub_details HD ON PR.hub_id = HD.id
                    LEFT JOIN users U on U.id = RRA.rider_id 
                    LEFT JOIN failure_reason FR ON RRA.failure_reason = FR.id
                    WHERE RRA.failure_reason IS NOT NULL  AND PR.hub_id IN  (SELECT hub_id from user_hub where user_id = ${user_id}) `

        if (filters?.startDate && filters?.endDate) {

            const dateStart = dayjs(filters?.startDate || new Date()).format('YYYY-MM-DD 00:00:00');
            const dateEnd = dayjs(filters?.endDate || new Date()).format('YYYY-MM-DD 23:59:59');

            query += ` AND PR.status_date >= '${dateStart}' AND PR.status_date <= '${dateEnd}'`;
        }

        query += ` ORDER BY PR.status_date DESC`

        return query;
    } catch (exception) {
        console.error(exception.message || exception);
        throw new Error(exception.message || exception);
    }
}

module.exports = { getFailureReason, getFailedTrips, getFailedTripExportQuery };