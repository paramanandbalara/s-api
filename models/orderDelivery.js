
const getDeliveryAddress = async (type, address_ref_id) => {
    try {
        const query = `SELECT * FROM delivery_location WHERE type = ? AND consignee_address_id = ?`
        const [rows] = await readDB.query(query, [type, address_ref_id])
        return rows
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message)
    }
}

const updateDeliveryAddress = async (delivery_addr_id, delivery_location) => {
    try {
        const query = `UPDATE delivery_location SET ? WHERE id = ? ;`
        const [rows] = await writeDB.query(query, [delivery_location, delivery_addr_id])
        return rows;
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message)
    }
}

const insertDeliveryAddr = async (delivery_location) => {
    try {
        const query = `INSERT INTO delivery_location SET ? ;`
        const [rows] = await writeDB.query(query, [delivery_location])
        return rows;
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message)
    }
}

const getDeliveryRequest = async (delivery_location_id, hub_id) => {
    try {
        const query = `SELECT * FROM delivery_request WHERE delivery_location_id = ? AND hub_id = ? AND state IN (1, 5)`
        const [rows] = await readDB.query(query, [delivery_location_id, hub_id])
        return rows;
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message)
    }
}

const insertDeliveryRequest = async (delivery_req_data) => {
    try {
        const query = `INSERT INTO delivery_request SET ? ;`
        const [rows] = await writeDB.query(query, [delivery_req_data])
        return rows;
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message)
    }
}

const updateDeliveryReq = async (delivery_req_id, update_delivery_req_obj) => {
    try {
        update_delivery_req_obj.status_date = new Date()
        const query = `UPDATE delivery_request SET ? WHERE id = ? ;`
        const [rows] = await writeDB.query(query, [update_delivery_req_obj, delivery_req_id])
        return rows;
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message)
    }
}

const openPickupTripsByDeliveryReq = async (delivery_req_id) => {
    try { 
        try {
            const query = 'SELECT * FROM route_request_assigned WHERE deliver_request_id = ? AND status = 0;'
            const [rows] = await readDB.query(query, [delivery_req_id])
            return rows;
        } catch (exception) {
            console.error(exception);
            throw new Error(exception)
        }
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message)
    }
}


const getOpenDeliveryRequestLocationExceptCurrent = async (delivery_location_id, delivery_request_no, hub_id) => {
    try {

        const [rows] = await readDB.query(`SELECT *
        FROM delivery_request dr
        WHERE dr.delivery_location_id = ? AND dr.state IN (1, 5) AND delivery_request_no <> ? AND dr.hub_id = ?;`, [delivery_location_id, delivery_request_no, hub_id])
        return rows

    } catch (error) {
        console.error(error)
        throw Error(error)
    }
}

const getTripCountByRiderId = async (rider_id, type) => {
    try {
        const query = `SELECT COUNT(id) count FROM route_request_assigned WHERE type = ? AND rider_id = ? AND status = 0;`
        const [rows] = await readDB.query(query, [type, rider_id]);

        return rows;
    } catch (exception) {
        throw new Error(exception.message || exception)
    }
}

const getDeliveryRequestId = async (delivery_request_no) => {
    try {
        const [rows] = await readDB.query(`SELECT id FROM delivery_request WHERE delivery_request_no = ? ORDER BY created DESC`, [delivery_request_no]);

        return rows

    } catch (error) {
        console.error(error)
        throw Error(error)
    }
}

const checkIfDeliveryReqNumExist = async (delivery_request_number) => {
    try {
        try {
            const query = `SELECT id FROM delivery_request WHERE delivery_request_no = ?;`
            const [rows] = await readDB.query(query, [delivery_request_number])
            return rows
        } catch (error) {
            console.error(error)
            throw Error(error)
        }
    } catch (exception) {
        console.error(exception);
        throw new Error(exception)
    }
}

const geDeliverRiderData = async (id) => {
    try {
        const [rows] = await readDB.query(`SELECT  U.name, O.awb, DR.delivery_date
                                           FROM orders O 
                                           LEFT JOIN delivery_request DR ON DR.id = O.deliver_request_id 
                                           LEFT JOIN route_request_assigned RRA ON RRA.id =  O.route_request_assigned_id  
                                           LEFT JOIN users U ON RRA.rider_id = U.id 
                                           WHERE O.id = ?;`,[id])

        return rows;
    } catch (exception) {
        console.error(exception)
        throw exception
    }
}

module.exports = {
    getDeliveryAddress, updateDeliveryAddress, insertDeliveryAddr,
    getDeliveryRequest, insertDeliveryRequest, updateDeliveryReq,
    openPickupTripsByDeliveryReq, getOpenDeliveryRequestLocationExceptCurrent,
    getTripCountByRiderId, getDeliveryRequestId, checkIfDeliveryReqNumExist, geDeliverRiderData
}