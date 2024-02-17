"use strict";

const dayjs = require('dayjs');

const getRiders = async (user_id) => {
    try {//role id = 2 => rider
        const query =
            `SELECT U.id,U.name
                FROM user_hub UH 
                JOIN users U ON U.id = UH.user_id
                WHERE U.role_id = 2 AND UH.hub_id IN (SELECT hub_id FROM user_hub WHERE user_id = ?) AND U.status = 1`

        const [rows] = await readDB.query(query, [user_id])

        return rows;

    } catch (exception) {
        throw new Error(exception.message || exception)
    }
}

const getPickupRequestsList = async (data) => {
    try {
        let { user_id, offset, limit, startDate, endDate, pickup_state, status, rider_id, sy_warehouse_id, pincodes, pickup_request_no, hub_code, city } = data;

        let query = ` SELECT PR.status_date, PR.id as pickup_request_id, PL.sy_warehouse_id, PL.address pickup_address, PL.city, PL.state, PL.contact_name, PL.contact_number, PL.pincode, U.name riderName, PL.company_name,
                        PR.manifested_orders_count, PR.pending_order_count, PR.pickup_request_no, PR.pickup_date, PR.state status, PR.pending_order_count, RRA.id as route_request_assigned_id, RRA.picked_order_count,
                        HD.code hub_code, HD.city hub_city, PR.secured_pickup, PR.rider_assigned_by
                        FROM pickup_request PR 
                        LEFT JOIN route_request_assigned RRA ON PR.id = RRA.pickup_request_id
                        INNER JOIN pickup_location PL ON PR.pickup_location_id = PL.id 
                        INNER JOIN user_hub UH ON UH.hub_id = PR.hub_id
                        LEFT JOIN users U ON U.id = RRA.rider_id
                        LEFT JOIN hub_details HD ON PR.hub_id = HD.id
                        WHERE 1 `;

        if (status === 0)
            query += ` AND PR.state IN (1,2,3,4,5,6)`

        if (status === 1)
            query += ` AND PR.state = 1`

        if (status === 2)
            query += ` AND PR.state = 2`

        if (status === 3)
            query += ` AND PR.state = 3`

        if (status === 4)
            query += ` AND PR.state = 4`

        if (status === 5)
            query += ` AND PR.state = 5`

        if (status === 6)
            query += ` AND PR.state = 6`

        if (sy_warehouse_id) {
            sy_warehouse_id = sy_warehouse_id.split(',')
            if (sy_warehouse_id.length)
                query += ` AND PL.sy_warehouse_id IN (${sy_warehouse_id})`
        }

        if (pickup_request_no) {
            pickup_request_no = pickup_request_no.split(',')
            if (pickup_request_no.length)
                query += ` AND PR.pickup_request_no IN (${pickup_request_no})`
        }

        if (pincodes) {
            pincodes = pincodes.split(',')
            if (pincodes.length)
                query += ` AND PL.pincode IN (${pincodes})`
        }

        if (user_id) {
            query += ` AND UH.user_id = ?`
        }

        if (rider_id) {
            query += ` AND RRA.rider_id = ${rider_id}`
        }

        if (startDate && endDate) {
            query += ` AND PR.pickup_date >= '${dayjs(startDate).format('YYYY-MM-DD 00:00:00')}' AND PR.pickup_date <= '${dayjs(endDate).format('YYYY-MM-DD 23:59:59')}'`
        }

        if (pickup_state) {
            query += ` AND PR.state = '${pickup_state}'`;
        }

        if (hub_code) {
            hub_code = hub_code.split(',')
            let hub_code_str = ``;
            if (hub_code.length) {
                hub_code_str = hub_code.map(item => `'${item}'`).join(', ');
                query += ` AND HD.code IN (${hub_code_str})`
            }
        }
        if (city) {
            city = city.split(',')
            let city_str = ``;
            if (city.length) {
                city_str = city.map(item => `'${item}'`).join(', ');
                query += ` AND HD.city IN (${city_str})`
            }
        }

        query += ` GROUP BY PR.id ORDER BY PR.status_date DESC LIMIT ?,?;`

        const [rows] = await readDB.query(query, [user_id, offset, limit])

        return rows;

    } catch (exception) {
        console.log(__line, exception)
        throw new Error(exception.message || exception)
    }
}


const getPickupRequestDataForPRS = async (rider_id) => {
    try {

        let query = `SELECT u.name riderName, PL.address pickup_address, PL.city, PL.contact_name, PL.contact_number, 
                PR.manifested_orders_count, PR.pickup_date, PR.pickup_request_no, max(RRA.created)
                FROM pickup_request PR 
                JOIN pickup_location PL ON PR.pickup_location_id = PL.id 
                LEFT JOIN route_request_assigned RRA on PR.id = RRA.pickup_request_id
                LEFT JOIN users u on u.id = RRA.rider_id
                WHERE RRA.rider_id IN (?) AND PR.state IN (1,3,5) GROUP BY RRA.pickup_request_id`;

        const [rows] = await readDB.query(query, [rider_id])

        return rows;

    } catch (exception) {
        console.log(__line, exception)
        throw new Error(exception.message || exception)
    }
}

const getPickupRequestsByHubId = async (hub_id) => {
    try {
        let query = `SELECT pr.pickup_request_no, pr.state, pr.verified_lat, pr.verified_long, u.name
                        FROM pickup_request pr
                        LEFT JOIN route_request_assigned rra ON pr.id = rra.pickup_request_id
                        LEFT JOIN users u ON rra.rider_id = u.id
                        WHERE pr.hub_id = ? AND pr.created BETWEEN '${dayjs(new Date).format('YYYY-MM-DD 00:00:00')}' AND '${dayjs(new Date).format('YYYY-MM-DD 23:59:59')}' ORDER BY pr.created DESC `;

        const [rows] = await readDB.query(query, [hub_id])

        return rows;

    } catch (exception) {
        console.log(__line, exception)
        throw new Error(exception.message || exception)
    }
}

const pickupComplete = async (updateData, pickup_request_no) => {
    try {
        updateData.status_date = new Date();
        const [rows] = await writeDB.query(`UPDATE pickup_request SET ? WHERE pickup_request_no = ?`, [updateData, pickup_request_no])
        return rows

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}


const updateDeliveryRequest = async (updateData, delivery_request_no) => {
    try {
        updateData.status_date = new Date()
        const [rows] = await writeDB.query(`UPDATE delivery_request SET ? WHERE delivery_request_no = ?`, [updateData, delivery_request_no])
        return rows

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const getPickupRequestDetailsByPRNo = async (pickup_request_no) => {
    try {
        const query = `SELECT * FROM pickup_request WHERE pickup_request_NO = ? ORDER BY created DESC`;
        const [rows] = await readDB.query(query, [pickup_request_no])
        return rows;
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const getDeliveryReuestDetailsBYDRNo = async (delivery_request_no) => {
    try {
        const query = `SELECT * FROM delivery_request WHERE delivery_request_no = ? ORDER BY created DESC`;
        const [rows] = await readDB.query(query, [delivery_request_no])
        return rows;
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}


const getPickupRequestsTimeline = async (pickup_req_id, offset, limit) => {
    try {
        const query = `SELECT O.route_request_assigned_id, O.status, O.awb
                        FROM orders O
                        WHERE O.pickup_request_id = ? AND O.route_request_assigned_id IS NULL AND O.status <> 2 GROUP BY O.id LIMIT ?,? `
        const [rows] = await readDB.query(query, [pickup_req_id, offset, limit]);
        return rows;
    }
    catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}


const getPickupRequestsTimelineFromOrderEvent = async (pickup_req_id, offset, limit) => {
    try {
        const query = `SELECT OE.route_request_assigned_id, OE.awb, O.status FROM order_event OE
                        INNER JOIN route_request_assigned RRA ON RRA.id = OE.route_request_assigned_id 
                        INNER JOIN orders O ON O.id = OE.order_id
                        WHERE RRA.pickup_request_id = ?
                        GROUP BY OE.awb LIMIT ?,?;`

        const [rows] = await readDB.query(query, [pickup_req_id, offset, limit]);
        return rows;
    }
    catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}


const getDeliveryRequestTimelineFromOrderEvent = async (deliver_request_id, offset, limit) => {
    try {
        const query = `SELECT OE.remarks as state, OE.status, OE.remarks, OE.event_created_at, DR.delivery_date, O.awb, U.name, FR.failure_reason FROM order_event OE 
                    INNER JOIN
                                (
                                    SELECT max(event_created_at) latest_event_created_at, route_request_assigned_id, awb, RRA.deliver_request_id
                                    FROM order_event OE
                                    INNER JOIN route_request_assigned RRA ON RRA.id = OE.route_request_assigned_id 
                                    WHERE RRA.deliver_request_id = ?
                                    GROUP BY awb
                                ) OET
                        ON OET.awb  = OE.awb
                        AND OE.event_created_at = OET.latest_event_created_at
                        INNER JOIN route_request_assigned RRA ON RRA.id = OE.route_request_assigned_id 
                        INNER JOIN orders O ON O.id = OE.order_id
                        INNER JOIN delivery_request DR ON DR.id = RRA.deliver_request_id
                        LEFT JOIN failure_reason FR ON RRA.failure_reason = FR.id
                        LEFT JOIN users U ON U.id = RRA.rider_id
                        WHERE DR.id = ? ORDER BY OE.event_created_at DESC  LIMIT ?,? `

        const [rows] = await readDB.query(query, [deliver_request_id, deliver_request_id, offset, limit]);
        return rows;
    }
    catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const getAllPickupRequests = async (pickup_request_no) => {
    try {
        const query = `SELECT * FROM pickup_request WHERE pickup_request_no IN (?) ORDER BY created DESC;`
        const [rows] = await readDB.query(query, [pickup_request_no])
        return rows;

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const getAllDeliveryRequests = async (delivery_request_no) => {
    try {
        const query = `SELECT * FROM delivery_request WHERE delivery_request_no IN (?) ORDER BY created DESC;`
        const [rows] = await readDB.query(query, [delivery_request_no])
        return rows;

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}


const savePickupTrips = async (pickup_trip_data) => {
    try {
        const [rows] = await writeDB.query('INSERT INTO route_request_assigned SET ?;', [pickup_trip_data])
        return rows;

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const getPickupTrips = async (rider_id, offset, limit) => {
    try {
        const query = `SELECT u.name riderName, RRA.id as route_request_assigned_id, RRA.pickup_request_id, RRA.assigned_order_count, RRA.picked_order_count,
                        PL.sy_warehouse_id, PL.address pickup_address, PL.city, PL.state, PL.contact_name, PL.contact_number, PL.pincode, RRA.status as status, PR.pickup_request_no, PR.pickup_date, 
                        PL.company_name, PR.secured_pickup, PR.hub_id
                        FROM route_request_assigned RRA 
                        JOIN pickup_request PR ON PR.id = RRA.pickup_request_id
                        JOIN pickup_location PL ON PR.pickup_location_id = PL.id 
                        LEFT JOIN users u ON u.id = RRA.rider_id
                        WHERE RRA.rider_id = ? 
                        ORDER BY FIELD(RRA.status, 1, 3, 2), RRA.created DESC LIMIT ?, ?;`;
        const [rows] = await readDB.query(query, [rider_id, offset, limit])
        return rows;

    } catch (exception) {
        console.error(exception);
        throw exception;
    }
}

const getPickupTripDataById = async (route_request_assigned_id) => {
    try {
        const query = `SELECT * FROM route_request_assigned WHERE id = ?;`
        const [rows] = await readDB.query(query, [route_request_assigned_id])
        return rows;

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const updatePickupTripCount = async (route_request_assigned_id, picked_awb_count) => {
    try {
        const query = `UPDATE route_request_assigned SET picked_order_count = picked_order_count + ${Number(picked_awb_count)} WHERE id = ?;`
        const [rows] = await writeDB.query(query, [route_request_assigned_id])
        return rows;

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}


const updateDeliverdOrderCount = async (route_request_assigned_id, deliver_order_count) => {
    try {
        const query = `UPDATE route_request_assigned SET deliver_order_count = deliver_order_count + ${Number(deliver_order_count)} WHERE id = ?;`
        const [rows] = await writeDB.query(query, [route_request_assigned_id])
        return rows;

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}
const getSumOfPickedOrderCount = async (pickup_request_id) => {
    try {
        const query = `SELECT SUM(picked_order_count) as picked_order_count FROM route_request_assigned WHERE pickup_request_id = ?;`
        const [rows] = await readDB.query(query, [pickup_request_id])
        return rows;


    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}


const getNotAssignedOrFailedCound = async (pickup_request_id) => {
    try {
        const query = `SELECT COUNT(orders.id) as picked_order_count FROM orders WHERE pickup_request_id = ? AND status NOT IN (2, 3);`
        const [rows] = await readDB.query(query, [pickup_request_id])
        return rows;


    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}


const getDeliveryPendingOrders = async (deliver_request_id) => {
    try {
        const query = `SELECT * FROM orders WHERE deliver_request_id = ? AND status IN (100, 101, 102);`
        const [rows] = await readDB.query(query, [deliver_request_id])
        return rows;


    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const getRiderNameByPickupReq = async (pickup_request_id, delivery_request_id) => {
    try {
        let query = `SELECT name 
        FROM route_request_assigned 
        LEFT JOIN users ON route_request_assigned.rider_id = users.id 
        WHERE 1`

        if (pickup_request_id) {
            query += ` AND route_request_assigned.pickup_request_id = ${pickup_request_id}`
        }

        if (delivery_request_id) {
            query += ` AND route_request_assigned.deliver_request_id = ${delivery_request_id}`
        }

        query += ` ORDER BY route_request_assigned.created DESC LIMIT 1 `

        const [rows] = await readDB.query(query)
        return rows;
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}


const updateRouteRequest = async (data, id) => {
    try {
        const [rows] = await writeDB.query(`UPDATE route_request_assigned SET ? WHERE id = ?`, [data, id])
        return rows

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const getRouteAssignmentId = async (pickupRequestId = null, deliverRequestId = null) => {
    try {
        let query = `SELECT id FROM route_request_assigned WHERE 1 `

        if (pickupRequestId)
            query += ` AND pickup_request_id = ${pickupRequestId}`

        if (deliverRequestId)
            query += ` AND deliver_request_id = ${deliverRequestId}`

        query += ` AND status = 0`
        const [rows] = await readDB.query(query)
        return rows;


    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const getWarehouseDetails = async (route_request_assigned_id) => {
    try {
        const query = `SELECT PL.sy_warehouse_id 
                        FROM route_request_assigned RRA 
                        JOIN pickup_request PR ON RRA.pickup_request_id = PR.id 
                        JOIN pickup_location PL ON PR.pickup_location_id = PL.id 
                        WHERE RRA.id = ?`
        const [rows] = await readDB.query(query, [route_request_assigned_id])
        return rows;


    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const get_route_request_assigned_ids = async (pickup_request_no) => {
    try {
        const [rows] = await readDB.query(`SELECT RRA.id FROM route_request_assigned RRA JOIN pickup_request PR ON RRA.pickup_request_id = PR.id WHERE PR.pickup_request_no = ? ORDER BY PR.created DESC`, [pickup_request_no])
        return rows
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const get_route_request_assigned_ids_delivery = async (delivery_request_no) => {
    try {
        const [rows] = await readDB.query(`SELECT RRA.id FROM route_request_assigned RRA JOIN delivery_request DR ON RRA.deliver_request_id = DR.id WHERE DR.delivery_request_no = ? ORDER BY DR.created DESC`, [delivery_request_no])
        return rows
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const getAWBs = async (pickup_request_no, offsets, limit) => {
    try {
        const [rows] = await readDB.query(`SELECT PR.pickup_date, PR.state, O.status, O.awb, FR.failure_reason, PR.id as pickup_request_id
                                           FROM pickup_request PR 
                                           LEFT JOIN orders O ON PR.id = O.pickup_request_id 
                                           LEFT JOIN route_request_assigned RRA ON PR.id = RRA.pickup_request_id
                                           LEFT JOIN failure_reason FR ON RRA.failure_reason = FR.id
                                           WHERE PR.pickup_request_no = ? ORDER BY PR.created DESC LIMIT ?,?`, [pickup_request_no, offsets, limit])
        return rows
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const getDeliveredAWBs = async (delivery_request_no, offsets, limit) => {
    try {
        const [rows] = await readDB.query(`SELECT DR.delivery_date, DR.state, O.status, O.awb, FR.failure_reason
                                           FROM delivery_request DR 
                                           LEFT JOIN orders O ON DR.id = O.deliver_request_id
                                           LEFT JOIN route_request_assigned RRA ON DR.id = RRA.deliver_request_id
                                           LEFT JOIN failure_reason FR ON RRA.failure_reason = FR.id
                                           WHERE DR.delivery_request_no = ? ORDER BY DR.created DESC LIMIT ?,?`, [delivery_request_no, offsets, limit])
        return rows
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}


const getDeliveryTrips = async (rider_id, offset, limit) => {
    try {
        const query = `SELECT u.name riderName, RRA.id as route_request_assigned_id, RRA.deliver_request_id, RRA.deliver_order_count, RRA.status as status, RRA.assigned_order_count,
                        DL.consignee_address_id, DL.address , DL.city, DL.state, DL.contact_name, DL.contact_number, DL.pincode, DR.delivery_request_no,
                        DR.delivery_request_no, DR.delivery_date 
                        FROM route_request_assigned RRA                          
                        JOIN delivery_request DR ON DR.id = RRA.deliver_request_id  
                        JOIN delivery_location DL ON DR.delivery_location_id = DL.id 
                        LEFT JOIN users u ON u.id = RRA.rider_id                 
                        WHERE RRA.rider_id = ?                                   
                        ORDER BY FIELD(RRA.status, 1, 3, 2), RRA.created DESC LIMIT ?, ?;`;
        const [rows] = await readDB.query(query, [rider_id, offset, limit])
        return rows;

    } catch (exception) {
        console.error(exception);
    }
}

const getDeliveryRequestData = async (data) => {
    try {
        let arr = [];
        let { user_id, offset, limit, startDate, endDate, state, pincodes, rider_id, status, delivery_request_no, hub_code, cities } = data;
        let query = `SELECT DR.id delivery_request_id, DR.delivery_request_no, DR.delivery_date, DR.orders_count, DR.pending_order_count, DR.state status, DR.status_date,
                     DL.contact_name, DL.contact_number, DL.address, DL.city, DL.state, DL.pincode, HD.city hub_city,
                     HD.code hub_code
                     FROM delivery_request DR
                     LEFT JOIN route_request_assigned RRA ON DR.id = RRA.deliver_request_id
                     LEFT JOIN delivery_location DL ON DR.delivery_location_id = DL.id
                     LEFT JOIN hub_details HD ON DR.hub_id = HD.id
                     JOIN user_hub UH ON UH.hub_id = DR.hub_id
                     WHERE 1`

        if (status == 0){
            query += ` AND DR.state IN (1,2,3,4,5)`
        }
        if (status == 1){
            query += ` AND DR.state = 1`
        }
        if (status == 2){
            query += ` AND DR.state = 5`
        }
        if (status == 3){
            query += ` AND DR.state = 2`
        }
        if (status == 4){
            query += ` AND DR.state = 3`
        }
        if (status == 5){
            query += ` AND DR.state = 4`
        }

        if (state) {
            arr.push(state)
            query += ` AND DR.state = ?`
        }

        if (user_id) {
            arr.push(user_id)
            query += ` AND UH.user_id = ?`
        }

        if (delivery_request_no) {
            delivery_request_no = delivery_request_no.split(',')
            if (delivery_request_no.length){
                arr.push(delivery_request_no)
                query += ` AND DR.delivery_request_no IN (?)`
            }
        }

        if (hub_code) {
            hub_code = hub_code.split(',')
            if (hub_code.length) {
                arr.push(hub_code)
                query += ` AND HD.code IN (?)`
            }
        }

        if (pincodes) {
            pincodes = pincodes.split(',')
            if (pincodes.length) {
                arr.push(pincodes)
                query += ` AND DL.pincode IN (?)`
            }
        }

        if (cities) {
            cities = cities.split(',')
            if (cities.length) {
                arr.push(cities)
                query += ` AND HD.city IN (?)`
            }
        }

        if (startDate && endDate) {
            arr.push(dayjs(startDate).format('YYYY-MM-DD 00:00:00'), dayjs(endDate).format('YYYY-MM-DD 23:59:59'))
            query += ` AND DR.delivery_date >= ? AND DR.delivery_date <= ?`
        }

        if (rider_id) {
            arr.push(rider_id)
            query += ` AND RRA.rider_id = ?`
        }
        
        arr.push(offset, limit)

        query += ` ORDER BY DR.created DESC LIMIT ?,?;`

        const [rows] = await readDB.query(query, arr)
        return rows;
    } catch (exception) {
        console.log(__line, exception)
        throw new Error(exception)
    }
}


const getDeliveryRequestDataForDRS = async (rider_id) => {
    try {

        let query = `SELECT u.name riderName, DL.address, DL.city, DL.contact_name, DL.contact_number, 
                DR.orders_count, DR.delivery_request_no, DR.id deliver_req_id, max(RRA.created)
                FROM delivery_request DR 
                INNER JOIN delivery_location DL ON DR.delivery_location_id = DL.id 
                LEFT JOIN route_request_assigned RRA on DR.id = RRA.deliver_request_id
                LEFT JOIN users u on u.id = RRA.rider_id
                WHERE RRA.rider_id IN (?) AND DR.state IN (1,3,5) GROUP BY RRA.deliver_request_id`;

        const [rows] = await readDB.query(query, [rider_id])

        return rows;

    } catch (exception) {
        console.log(__line, exception)
        throw new Error(exception.message || exception)
    }
}

const getOverAgeCountByRRAid = async (route_req_ids) => {
    try {
        const query = `SELECT COUNT(id) overage_order_count, pickup_request_id, route_request_assigned_id FROM orders WHERE route_request_assigned_id IN (?) AND pickup_request_id IS NULL GROUP BY route_request_assigned_id;`
        const [rows] = await readDB.query(query, [route_req_ids])
        return rows;
    } catch (exception) {
        console.log(__line, exception)
        throw new Error(exception.message || exception)
    }
}

const openDeliveryTripsByPickupReq = async (delivery_req_id) => {
    try {
        const query = 'SELECT * FROM route_request_assigned WHERE deliver_request_id = ? AND status = 0;'
        const [rows] = await readDB.query(query, [delivery_req_id])
        return rows;
    } catch (exception) {
        console.error(exception);
        throw new Error(exception)
    }
}

const getPickupRequestDetailById = async (pickupRequestId) => {
    try {
        const query = `SELECT PR.status_date, PR.id AS pickup_request_id, U.name AS riderName, 
                        PR.manifested_orders_count, PR.pending_order_count, PR.pickup_request_no, 
                        PR.pickup_date, PR.state AS status, RRA.id AS route_request_assigned_id,
                        RRA.picked_order_count, PR.created AS pickup_request_created, RRA.created AS rider_assigned_date,
                        OE.awb, FR.failure_reason, PR.rider_assigned_by
                        FROM pickup_request AS PR 
                        LEFT JOIN route_request_assigned AS RRA ON PR.id = RRA.pickup_request_id
                        LEFT JOIN order_event OE ON OE.route_request_assigned_id = RRA.id
                        LEFT JOIN users AS U ON U.id = RRA.rider_id
                        LEFT JOIN failure_reason FR ON RRA.failure_reason = FR.id
                        WHERE PR.id = ? GROUP BY OE.status;`;
        const [rows] = await readDB.query(query, [pickupRequestId]);
        return rows;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

const getDeliveyRequestDetailById = async (deliveyRequestId) => {
    try {
        const query = `SELECT DR.status_date, DR.id AS deliver_request_id, U.name AS riderName, 
                        DR.orders_count, DR.pending_order_count, DR.delivery_request_no, 
                        DR.delivery_date, DR.state AS status, RRA.id AS route_request_assigned_id,
                        RRA.deliver_order_count delivered_order_count, DR.created AS delivery_request_created, RRA.created AS rider_assigned_date,
                        OE.awb, FR.failure_reason
                        FROM delivery_request AS DR 
                        LEFT JOIN route_request_assigned AS RRA ON DR.id = RRA.deliver_request_id
                        LEFT JOIN order_event OE ON OE.route_request_assigned_id = RRA.id
                        LEFT JOIN users AS U ON U.id = RRA.rider_id
                        LEFT JOIN failure_reason FR ON RRA.failure_reason = FR.id
                        WHERE DR.id = ? GROUP BY OE.status;`;
        const [rows] = await readDB.query(query, [deliveyRequestId]);
        return rows;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

const getWareHouseAndPrDetailsByPrId = async (pickupRequestId) => {
    try {
        const query = `SELECT
                            PL.sy_warehouse_id,
                            PL.company_name,
                            HD.code AS hub_code,
                            HD.city AS hub_city,
                            PR.pending_order_count AS failed_orders,
                            PR.state AS status,
                            RRA.id route_request_assigned_id,
                            CONCAT(
                                FLOOR(TIMESTAMPDIFF(MINUTE, RRA.created, PR.status_date) / 60),
                                ':',
                                LPAD(TIMESTAMPDIFF(MINUTE, RRA.created, PR.status_date) % 60, 2, '0')
                            ) AS duration,
                            CASE WHEN VO.type = 1 THEN 'Yes' ELSE 'No' END AS otp_verified
                        FROM
                            pickup_request PR
                            INNER JOIN pickup_location PL ON PL.id = PR.pickup_location_id
                            INNER JOIN hub_details HD ON HD.id = PR.hub_id
                            LEFT JOIN route_request_assigned RRA ON PR.id = RRA.pickup_request_id
                            LEFT JOIN verify_otp VO ON PR.id = VO.request_id
                        WHERE PR.id = ?;`
        const [rows] = await readDB.query(query, [pickupRequestId]);
        return rows;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

const getReassignPickupRequestDetails = async (awbs, pickup_request_created) => {
    try {
        const query = `SELECT PR.status_date, PR.id AS pickup_request_id, U.name AS riderName, 
                        PR.manifested_orders_count, PR.pending_order_count, PR.pickup_request_no, 
                        PR.pickup_date, PR.state AS status, RRAA.id AS route_request_assigned_id, 
                        RRAA.picked_order_count, PR.created AS pickup_request_created, RRAA.created AS rider_assigned_date,
                        OE.awb, FR.failure_reason, PR.rider_assigned_by
                        FROM pickup_request AS PR
                        INNER JOIN route_request_assigned AS RRA ON PR.id = RRA.reassign_pickup_request_id
                        INNER JOIN order_event OE ON OE.route_request_assigned_id = RRA.id
                        LEFT JOIN route_request_assigned RRAA ON RRAA.pickup_request_id = PR.id
                        LEFT JOIN users AS U ON U.id = RRAA.rider_id
                        LEFT JOIN failure_reason FR ON RRAA.failure_reason = FR.id
                        WHERE OE.awb IN (?) AND PR.created > ?
                        GROUP BY PR.id;`;
        const [rows] = await readDB.query(query, [awbs, pickup_request_created]);
        return rows;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

const getReassignDeliveyRequestDetails = async (awbs, delivery_request_created) => {
    try {
        const query = `SELECT DR.status_date, DR.id AS delivey_request_id, U.name AS riderName, 
                        DR.orders_count, DR.pending_order_count, DR.delivery_request_no, 
                        DR.delivery_date, DR.state AS status, RRA.id AS route_request_assigned_id, 
                        RRAA.deliver_order_count delivered_order_count, DR.created AS delivery_request_created, RRAA.created AS rider_assigned_date,
                        OE.awb, FR.failure_reason
                        FROM delivery_request AS DR
                        INNER JOIN route_request_assigned AS RRA ON DR.id = RRA.reassign_pickup_request_id
                        INNER JOIN order_event OE ON OE.route_request_assigned_id = RRA.id
                        LEFT JOIN route_request_assigned RRAA ON RRAA.deliver_request_id = DR.id
                        LEFT JOIN users AS U ON U.id = RRAA.rider_id
                        LEFT JOIN failure_reason FR ON RRAA.failure_reason = FR.id
                        WHERE OE.awb IN (?) AND DR.created > ?
                        GROUP BY DR.id;`
        const [rows] = await readDB.query(query, [awbs, delivery_request_created]);
        return rows;
    } catch (error) {
        console.error(error);
        throw error;
    }
}


const getDeliveryRequestsTimelineFromOrderEvent = async (deliveryRequestId, offset, limit) => {
    try {
        const query = `SELECT OE.route_request_assigned_id, OE.awb, O.status FROM order_event OE
                        INNER JOIN route_request_assigned RRA ON RRA.id = OE.route_request_assigned_id 
                        INNER JOIN orders O ON O.id = OE.order_id
                        WHERE RRA.deliver_request_id = ?
                        GROUP BY OE.awb LIMIT ?,?;`

        const [rows] = await readDB.query(query, [deliveryRequestId, offset, limit]);
        return rows;
    }
    catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const getDeliveryRequestsTimeline = async (pickup_req_id, offset, limit) => {
    try {
        const query = `SELECT O.route_request_assigned_id, O.status, O.awb
                        FROM orders O
                        WHERE O.deliver_request_id = ? GROUP BY O.id LIMIT ?,? `
        const [rows] = await readDB.query(query, [pickup_req_id, offset, limit]);
        return rows;
    }
    catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const getWareHouseAndDeliveyDetails = async (deliveryRequestId) => {
    try {
        const query = `SELECT
                            DL.id address_id,
                            DL.contact_name,
                            HD.code AS hub_code,
                            HD.city AS hub_city,
                            DR.pending_order_count AS failed_orders,
                            DR.state AS status,
                            CONCAT(
                                FLOOR(TIMESTAMPDIFF(MINUTE, RRA.created, DR.status_date) / 60),
                                ':',
                                LPAD(TIMESTAMPDIFF(MINUTE, RRA.created, DR.status_date) % 60, 2, '0')
                            ) AS duration,
                            CASE WHEN VO.type = 1 THEN 'Yes' ELSE 'No' END AS otp_verified
                        FROM
                            delivery_request DR
                            INNER JOIN delivery_location DL ON DL.id = DR.delivery_location_id
                            INNER JOIN hub_details HD ON HD.id = DR.hub_id
                            LEFT JOIN route_request_assigned RRA ON DR.id = RRA.deliver_request_id
                            LEFT JOIN verify_otp VO ON DR.id = VO.request_id
                        WHERE DR.id = ?;`
        const [rows] = await readDB.query(query, [deliveryRequestId]);
        return rows;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

const getAwbsByDelReqId = async (deliveryReqID) => {
    try {
        const query = `SELECT awb, deliver_request_id FROM orders WHERE deliver_request_id IN (?)`
        const [rows] = await readDB.query(query, [deliveryReqID])
        return rows;


    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const checkOrderModeExistInPickupRequest = async (pickupRequestsIds, mode) => {
    try {
        const query = `SELECT pickup_request_id, mode FROM orders WHERE pickup_request_id IN (?) AND mode = ? GROUP BY pickup_request_id;`; 
        const [rows] = await readDB.query(query, [pickupRequestsIds, mode])
        return rows;
    }catch(error) {
        console.error(error);
        throw error;
    }
}

const getTotalWeightByPickupRequest = async (pickupRequestsIds) => {
    try {
        const query = `SELECT pickup_request_id, SUM(package_weight) as totalWeight FROM orders WHERE pickup_request_id IN (?) GROUP BY pickup_request_id;`;
        const [rows] = await readDB.query(query, [pickupRequestsIds])
        return rows;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

module.exports = {
    getRiders,
    getPickupRequestsList,
    getPickupRequestDataForPRS,
    getPickupRequestsByHubId,
    pickupComplete,
    getPickupRequestDetailsByPRNo,
    getAllPickupRequests,
    savePickupTrips,
    getPickupTrips,
    getPickupTripDataById,
    updatePickupTripCount,
    getSumOfPickedOrderCount,
    getRiderNameByPickupReq,
    updateRouteRequest,
    getNotAssignedOrFailedCound,
    getPickupRequestsTimeline,
    get_route_request_assigned_ids,
    getAWBs,
    getRouteAssignmentId,
    getWarehouseDetails,
    getDeliveryTrips,
    getAllDeliveryRequests,
    getDeliveryRequestData,
    updateDeliverdOrderCount,
    getDeliveryReuestDetailsBYDRNo,
    getDeliveryPendingOrders,
    updateDeliveryRequest,
    get_route_request_assigned_ids_delivery,
    getDeliveredAWBs,
    getDeliveryRequestsTimeline,
    getDeliveryRequestDataForDRS,
    getPickupRequestsTimelineFromOrderEvent,
    getOverAgeCountByRRAid,
    openDeliveryTripsByPickupReq,
    getDeliveryRequestTimelineFromOrderEvent,
    getPickupRequestDetailById,
    getWareHouseAndPrDetailsByPrId,
    getReassignPickupRequestDetails,
    getDeliveyRequestDetailById,
    getReassignDeliveyRequestDetails,
    getDeliveryRequestsTimelineFromOrderEvent,
    getWareHouseAndDeliveyDetails,
    getAwbsByDelReqId,
    checkOrderModeExistInPickupRequest,
    getTotalWeightByPickupRequest
}
