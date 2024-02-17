"use strict";

const moment = require('moment')


const getTotalRidersCount = async (filters, hubid) => {
    try {

        if (!hubid?.length) {
            return [{ totalRidersCount: 0 }]
        }

        let sql = `SELECT COUNT(U.id) totalRidersCount
                FROM user_hub UH 
                JOIN users U ON U.id = UH.user_id
                WHERE U.role_id = 2 AND UH.hub_id IN (?)`

        const [rows] = await readDB.query(sql, [hubid]);

        if (!rows.length) return [{ totalRidersCount: 0 }];

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getTotalOrders = async (filters, hubid) => {
    try {

        if (!hubid?.length) {
            return [{ totalPickupOrdersCount: 0 }]
        }

        let sql = `SELECT COUNT(id) totalOrdersCount
                    FROM orders WHERE hub_id IN (?) AND status <> 0 AND status <> 2 AND  pickup_delivery = 1`

        if (filters?.startDate && filters?.endDate) {

            const dateStart = moment(filters?.startDate || new Date()).format('YYYY-MM-DD 00:00:00');
            const dateEnd = moment(filters?.endDate || new Date()).format('YYYY-MM-DD 23:59:59');

            sql += ` AND order_receive_date >= '${dateStart}' AND order_receive_date <= '${dateEnd}'`;
        }

        const [rows] = await readDB.query(sql, [hubid]);

        if (!rows.length) return [{ totalPickupOrdersCount: 0 }];

        return rows;

    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message)
    }
}

const getTotalDeliveryOrders = async ({startDate, endDate, hubIdsArr}) => {
    try {
        const query = `SELECT COUNT(id) totalDeliveryOrdersCount
                                    FROM orders 
                                    WHERE 
                                        hub_id IN (?) 
                                        AND status NOT IN (0,2) 
                                        AND pickup_delivery = 2
                                        AND order_receive_date BETWEEN ? AND ?;`;
        const [rows] = await readDB.query(query, [hubIdsArr, startDate, endDate]);
        return rows;
    } catch (exception) {
        console.error(exception);
        throw exception;
    }
}

const getWorkingRiderCount = async (filters, user_id) => {
    try {
        let { hubid, startDate, endDate } = filters;

        if (!hubid?.length) {
            return [{ workingRidersCount: 0 }]
        }
        let sql = `SELECT COUNT(DISTINCT UH.user_id) workingRidersCount
            FROM user_hub UH
            JOIN users U on U.id = UH.user_id
            JOIN rider_checkin_checkout RCC on RCC.user_id=U.id
            WHERE U.role_id = 2 AND UH.hub_id IN (?)`;

        if (startDate && endDate) {

            const dateStart = moment(startDate || new Date()).format('YYYY-MM-DD 00:00:00');
            const dateEnd = moment(endDate || new Date()).format('YYYY-MM-DD 23:59:59');

            sql += ` AND RCC.checkin_date >= '${dateStart}' AND RCC.checkin_date <= '${dateEnd}'`;
        }

        const [rows] = await readDB.query(sql, [hubid]);

        if (!rows.length) return [{ workingRidersCount: 0 }];

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getPickupCount = async (filters, hubid) => {
    try {

        if (!hubid?.length) {
            [{ pickupLocationCount: 0 }]
        }

        let sql = `SELECT COUNT(DISTINCT pickup_location_id) pickupLocationCount from pickup_request WHERE hub_id IN (?) `;

        if (filters?.startDate && filters?.endDate) {

            const dateStart = moment(filters?.startDate || new Date()).format('YYYY-MM-DD 00:00:00');
            const dateEnd = moment(filters?.endDate || new Date()).format('YYYY-MM-DD 23:59:59');

            sql += ` AND created >= '${dateStart}' AND created <= '${dateEnd}'`;
        }

        const [rows] = await readDB.query(sql, [hubid]);

        if (!rows.length) return [{ pickupLocationCount: 0 }];

        return rows;

    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message)
    }
}

const getUnassignedTripCountDelivery = async (filters) => {
    try {
        let { hubid, startDate, endDate } = filters;

        if (!hubid?.length) {
            return [{ getUnassignedTripCountDelivery: 0 }]
        }

        let sql = `SELECT COUNT(DISTINCT DR.id) getUnassignedTripCountDelivery 
                   FROM delivery_request DR
                   WHERE DR.hub_id IN (?) AND DR.state IN (1)`

        if (startDate && endDate) {

            const dateStart = moment(startDate || new Date()).format('YYYY-MM-DD 00:00:00');
            const dateEnd = moment(endDate || new Date()).format('YYYY-MM-DD 23:59:59');

            sql += ` AND DR.delivery_date >= '${dateStart}' AND DR.delivery_date <= '${dateEnd}'`;
        }
        const [rows] = await readDB.query(sql, [hubid]);

        if (!rows.length) return [{ getUnassignedTripCountDelivery: 0 }];

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getUnassignedTripCountPickup = async (filters) => {
    try {
        let { hubid, startDate, endDate } = filters;

        if (!hubid?.length) {
            return [{ getUnassignedTripCountPickup: 0 }]
        }

        let sql = `SELECT COUNT(DISTINCT PR.id) getUnassignedTripCountPickup 
                   FROM pickup_request PR
                   WHERE PR.hub_id IN (?) AND PR.state IN (1)`

        if (startDate && endDate) {

            const dateStart = moment(startDate || new Date()).format('YYYY-MM-DD 00:00:00');
            const dateEnd = moment(endDate || new Date()).format('YYYY-MM-DD 23:59:59');

            sql += ` AND PR.pickup_date >= '${dateStart}' AND PR.pickup_date <= '${dateEnd}'`;
        }
        const [rows] = await readDB.query(sql, [hubid]);

        if (!rows.length) return [{ getUnassignedTripCountPickup: 0 }];

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getDashbordOrderGraphData = async (hubIds, days, remark, status) => {
    try {
        const startDate = moment().subtract(days, 'days').format('YYYY-MM-DD');

        let sql = `SELECT COUNT(DISTINCT OE.awb) AS orderCount,
                   DATE_FORMAT(OE.event_created_at, '%d %b, %Y') AS dayCreated
                    FROM order_event OE
                    WHERE OE.event_created_at >= ? 
                        AND OE.status = ?
                        AND OE.hub_id IN (?) `;

        const queryParams = [startDate, status, hubIds];
        if (status === 4) {
            sql += ` AND OE.remarks = ? `;
            queryParams.push(remark);
        }

        sql += ` GROUP BY dayCreated;`;
        const [rows] = await readDB.query(sql, queryParams);
        return rows;
    } catch (exception) {
        throw exception;
    }
};


const getDistanceCovered = async (filters, days) => {
    try {
        let { hubid } = filters;

        if (!hubid?.length) {
            return [{ distanceCovered: 0 }]
        }

        let start_date = moment().subtract(days, 'days').format('YYYY-MM-DD');

        let sql = `SELECT (SUM(RCC.checkout_odometer_reading ) - SUM(RCC.checkin_odometer_reading))distanceCovered, 
                   date_format(RCC.created, '%d %b, %Y') AS dayCreated
                   FROM rider_checkin_checkout RCC 
                   LEFT JOIN user_hub UH ON RCC.user_id = UH.user_id
                   WHERE RCC.created >= ? AND UH.hub_id IN (?) AND RCC.status = 2
                   GROUP BY dayCreated`

        const [rows] = await readDB.query(sql, [start_date, hubid]);

        if (!rows.length) return [{ distanceCovered: 0 }];

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}

const totalPendingPickupReq = async (filters, hubid) => {
    try {
        let sql = `SELECT COUNT(id) totalPendingPickupReq, SUM(pending_order_count) pending_order_count
                    FROM pickup_request WHERE hub_id IN (?) AND state = 5`

        if (filters?.startDate && filters?.endDate) {

            const dateStart = moment(filters?.startDate || new Date()).format('YYYY-MM-DD 00:00:00');
            const dateEnd = moment(filters?.endDate || new Date()).format('YYYY-MM-DD 23:59:59');

            sql += ` AND status_date >= '${dateStart}' AND status_date <= '${dateEnd}' GROUP BY state`;
        }

        const [rows] = await readDB.query(sql, [hubid]);
        return rows;
    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getfailedPickupReq = async (filters, hubid) => {
    try {
        let sql = `SELECT COUNT(id) toalFailedPickupReq, SUM(pending_order_count) failed_order_count
                    FROM pickup_request WHERE hub_id IN (?) AND state = 3`

        if (filters?.startDate && filters?.endDate) {

            const dateStart = moment(filters?.startDate || new Date()).format('YYYY-MM-DD 00:00:00');
            const dateEnd = moment(filters?.endDate || new Date()).format('YYYY-MM-DD 23:59:59');

            sql += ` AND status_date >= '${dateStart}' AND status_date <= '${dateEnd}' GROUP BY state`;
        }

        const [rows] = await readDB.query(sql, [hubid]);

        return rows;
    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getRouteRequestByPickupReq = async (filters, hubid, status) => {
    try {
        let sql = `SELECT PR.id pickup_request_id, RRA.id route_request_assigned_id, RRA.picked_order_count
                    FROM pickup_request PR 
                    INNER JOIN route_request_assigned RRA ON RRA.pickup_request_id = PR.id 
                    WHERE PR.hub_id IN (?) AND PR.state =  ? `

        if (filters?.startDate && filters?.endDate) {

            const dateStart = moment(filters?.startDate || new Date()).format('YYYY-MM-DD 00:00:00');
            const dateEnd = moment(filters?.endDate || new Date()).format('YYYY-MM-DD 23:59:59');

            sql += ` AND PR.status_date >= '${dateStart}' AND PR.status_date <= '${dateEnd}';`;
        }
        const [rows] = await readDB.query(sql, [hubid, status]);

        return rows;
    } catch (exception) {
        throw new Error(exception.message)
    }
}


const completedOrderCountByRraId = async (route_request_assigned_ids) => {
    try {
        const query = `SELECT COUNT(OE.id) order_count 
                        FROM order_event OE 
                        INNER JOIN orders O ON O.id = OE.order_id 
                        WHERE OE.route_request_assigned_id IN (?) 
                        AND OE.status = 4 AND OE.remarks = 'Picked-up';`
        const [rows] = await readDB.query(query, [route_request_assigned_ids]);

        return rows;
    } catch (exception) {
        console.error(exception)
    }
}
const orderCountsPartial = async (filters, hubid) => {
    try {
        const dateStart = moment(filters?.startDate || new Date()).format('YYYY-MM-DD 00:00:00');
        const dateEnd = moment(filters?.endDate || new Date()).format('YYYY-MM-DD 23:59:59');
        const query = `SELECT COUNT(OE.id) order_count 
                        FROM order_event OE 
                        INNER JOIN orders O ON O.id = OE.order_id
                        WHERE OE.status = 4 AND OE.event_created_at >= ? 
                            AND OE.event_created_at <= ? 
                            AND OE.route_request_assigned_id IS NULL AND OE.remarks = 'Picked-up (hub)' AND  O.hub_id IN (?);`
        const [rows] = await readDB.query(query, [dateStart, dateEnd, hubid]);

        return rows;
    } catch (exception) {
        console.error(exception)
    }
}

const getHubWiseOrders = async (days, hubIds) => {
    try {
        let start_date = moment().subtract(days, 'days').format('YYYY-MM-DD');

        const query = `SELECT count(OE.awb)order_count, HD.name, HD.code, HD.city
                        FROM order_event OE
                        INNER JOIN orders O ON OE.awb = O.awb
                        INNER JOIN hub_details HD ON 
                            (OE.status = 4 AND O.hub_id = HD.id) 
                            OR 
                            (OE.status = 18 AND O.dropoff_hub_id = HD.id)
                        WHERE OE.event_created_at >= ? AND 
                        ((OE.status = 4 AND O.hub_id IN (?)) OR (OE.status = 18 AND O.dropoff_hub_id IN (?)))
                        GROUP BY HD.city ORDER BY order_count DESC;`;


        const [rows] = await readDB.query(query, [start_date, hubIds, hubIds]);

        return rows;

    } catch (exception) {
        throw exception
    }
}

module.exports = {
    getTotalRidersCount,
    getWorkingRiderCount,
    getPickupCount,
    getTotalOrders,
    getTotalDeliveryOrders,
    getUnassignedTripCountDelivery,
    getUnassignedTripCountPickup,
    getDashbordOrderGraphData,
    getDistanceCovered,
    totalPendingPickupReq,
    getfailedPickupReq,
    getRouteRequestByPickupReq,
    completedOrderCountByRraId,
    orderCountsPartial,
    getHubWiseOrders
};
