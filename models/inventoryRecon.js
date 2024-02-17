
"use strict";

const dayjs = require('dayjs')

const getAwbsCount = async (status, hubId, { startDate, endDate }) => {
    try {
        startDate = dayjs(startDate).format('YYYY-MM-DD 00:00:00');
        endDate = dayjs(endDate).format('YYYY-MM-DD 23:59:59');

        const query = ` SELECT COUNT(DISTINCT OE.id) awbsCount
                        FROM order_event OE 
                        WHERE OE.status = ? 
                        AND OE.hub_id IN (?) 
                        AND OE.created BETWEEN ? AND ?;`;

        const [rows] = await readDB.query(query, [status, hubId, startDate, endDate]);
        return rows;
    } catch (exception) {
        throw exception;
    }
}

const getInventoryData = async ({ filters, hubId, offset, limit, exportReport = false }) => {
    try {
        let { startDate, endDate } = filters;
        startDate = dayjs(startDate).format('YYYY-MM-DD 00:00:00')
        endDate = dayjs(endDate).format('YYYY-MM-DD 23:59:59')
        let query = `
                  SELECT
                    O.id,
                    O.awb,
                    O.package_weight AS weight,
                    O.package_value AS value,
                    O.created AS received_on,
                    O.inscan_date AS in_scan_date,
                    B.bag_code,
                    B.bag_sealno,
                    B.outscan_date,
                    B.transporter_awbno,
                    B.gateway_inscan_date,
                    HD.code,
                    HD.city,
                    T.name AS transporter_name,
                    OE.id AS order_event_id,
                    DHD.code as dropoff_hub_code,
                    DHD.city as dropoff_hub_city
                  FROM
                    orders O
                    JOIN order_event OE ON O.id = OE.order_id
                    JOIN hub_details HD ON O.hub_id = HD.id
                    LEFT JOIN bag_details B ON O.bag_id = B.id
                    LEFT JOIN transporter T ON B.transporter_id = T.id
                    LEFT JOIN hub_details DHD ON O.dropoff_hub_id = DHD.id
                  WHERE
                    O.hub_id IN (?)
                    AND OE.status IN (5, 6, 7)
                    AND OE.event_created_at BETWEEN ? AND ?
                  GROUP BY O.awb
                  ORDER BY O.id DESC `

        if (exportReport) {
            return readDB.format(query, [hubId, startDate, endDate])
        }
        query += ` LIMIT ?,?;`;
        const [rows] = await readDB.query(query, [hubId, startDate, endDate, offset, limit]);
        return rows;
    }
    catch (exception) {
        throw exception;
    }
}

const getOrderEventsByAwbs = async (awbs, status) => {
    try {
        const query = ` SELECT id , event_created_at, awb  FROM order_event WHERE status = ? AND awb IN (?)`
        const [rows] = await readDB.query(query, [status, awbs]);
        return rows;
    } catch (exception) {
        throw exception;
    }
}

const getOrderEventsDates = async (awbs) => {
    try {
        // 4-- pickedup, 6-- bagged, 11-- inbound
        const query = ` SELECT status , event_created_at, awb  FROM order_event WHERE status IN (4,6,11) AND awb IN (?)`
        const [rows] = await readDB.query(query, [ awbs]);
        return rows;
    } catch (exception) {
        throw exception;
    }

}

module.exports = { getInventoryData, getOrderEventsByAwbs, getOrderEventsDates, getAwbsCount }