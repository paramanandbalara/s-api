"use strict"

const getPickupRequestData = async (pickupLocationId, hub_id, securePickup) => {
    try {
        //state => 1:Open, 2:Succcess, 3:Failed

        const [rows] = await readDB.query(`SELECT *
        FROM pickup_request pr
        WHERE pr.pickup_location_id = ? AND pr.state IN (1, 5) 
        AND pr.hub_id = ? AND secured_pickup = ? ORDER BY created DESC;`, [pickupLocationId, hub_id, securePickup])
        return rows

    } catch (error) {
        console.error(error)
        throw Error(error)
    }
}

const insertPickupRequest = async (insertData) => {
    try {

        const [rows] = await writeDB.query(`INSERT INTO pickup_request SET ?`, ...[insertData]);
        return rows

    } catch (error) {
        console.error(error)
        throw Error(error)
    }
}

const updatePickupRequest = async (updateData, pickup_request_db_id) => {
    try {
        updateData.status_date = new Date();
        const [rows] = await writeDB.query(`UPDATE pickup_request SET ? WHERE id = ?`, [updateData, pickup_request_db_id])
        return rows

    } catch (error) {
        console.error(error)
        throw Error(error)
    }
}

const updateDeliveryRequest = async (updateData, delivery_request_db_id) => {
    try {
        updateData.status_date = new Date();
        const [rows] = await writeDB.query(`UPDATE delivery_request SET ? WHERE id = ?`, [updateData, delivery_request_db_id])
        return rows

    } catch (error) {
        console.error(error)
        throw Error(error)
    }
}

const openPickupTripsByPickupReq = async (pickup_request_id) => {
    try {
        const query = 'SELECT * FROM route_request_assigned WHERE pickup_request_id = ? AND status = 0;'
        const [rows] = await readDB.query(query, [pickup_request_id])
        return rows;
    } catch (exception) {
        console.error(exception);
        throw new Error(exception)
    }
}

const getPickupRequestId = async (pickup_request_no) => {
    try {
        const [rows] = await readDB.query(`SELECT id FROM pickup_request WHERE pickup_request_no = ? ORDER BY created DESC`, [pickup_request_no]);

        return rows

    } catch (error) {
        console.error(error)
        throw Error(error)
    }
}

// const checkExistingRider = async (pickup_request_no = false, delivery_request_no = false) => {
const getDeliveryRequestId = async (delivery_request_no) => {
    try {

        const [rows] = await readDB.query(`SELECT * FROM delivery_request WHERE delivery_request_no = ? ORDER BY created DESC`, [delivery_request_no]);

        return rows

    } catch (error) {
        console.error(error)
        throw Error(error)
    }
}

const checkExistingRider = async (pickup_request_no = false, delivery_request_no = false) => {

    try {
        let query = ``;

        if (pickup_request_no) {
            query = `SELECT id pickup_request_id, rider_assigned_by, hub_id, state, pickup_request_no FROM pickup_request WHERE pickup_request_no IN (${pickup_request_no}) ORDER BY created DESC`;
        }

        if (delivery_request_no) {
            query = `SELECT id delivery_request_id, rider_assigned_by, hub_id, state, delivery_request_no FROM delivery_request WHERE delivery_request_no IN (${delivery_request_no}) ORDER BY created DESC`;
        }

        const [rows] = await readDB.query(query);

        return rows;

    }
    catch (exception) {
        console.error(exception)
        throw new Error(exception.message)
    }
}


const getPickupRequestDataByDBId = async (pickupReqDbId) => {
    try {
        const [rows] = await readDB.query(`SELECT pending_order_count, manifested_orders_count FROM pickup_request WHERE id = ?`, [pickupReqDbId])
        return rows

    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message)

    }
}


const getAlreadyStatusChangedawbs = async (awbs) => {
    try {
        const query = `SELECT shypmax_id as awb FROM orders WHERE (awb IN (?) OR shypmax_id in (?)) AND status != 0;`
        const [rows] = await readDB.query(query, [awbs, awbs])
        return rows;
    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message)

    }
}

const getOpenPickupReqByPickupLocationExceptCurrent = async (pickupLocationId, pickup_request_no, hubId, securePickup) => {
    try {

        const [rows] = await readDB.query(`SELECT *
        FROM pickup_request pr
        WHERE pr.pickup_location_id = ? AND pr.state IN (1, 5) AND pickup_request_no <> ? AND pr.hub_id AND secured_pickup = ? ORDER BY created DESC;`, [pickupLocationId, pickup_request_no, hubId, securePickup]);
        return rows

    } catch (error) {
        console.error(error)
        throw Error(error)
    }
}

const getOpenPickupRequests = async () => {
    try {
        const query = `SELECT * FROM pickup_request WHERE state = 1;`
        const [rows] = await readDB.query(query)
        return rows
    } catch (error) {
        console.error(error)
        throw Error(error)
    }
}

const checkIfPickupReqNumExist = async (pickup_request_no) => {
    try {
        const query = `SELECT id FROM pickup_request WHERE pickup_request_no = ?;`
        const [rows] = await readDB.query(query, [pickup_request_no])
        return rows
    } catch (error) {
        console.error(error)
        throw Error(error)
    }
}

const getRouteReqAndPickupReqByPickuRequestid = async (pickupRequestId) => {
    try {
        const query = `SELECT RRA.assigned_order_count, PR.manifested_orders_count 
                    FROM pickup_request PR
                    LEFT JOIN route_request_assigned RRA 
                    ON PR.id = RRA.pickup_request_id
                    WHERE PR.id = ?;`
        const [rows] = await readDB.query(query, [pickupRequestId])
        return rows;
    } catch (exception) {
        console.error(exception)
        throw new Error(exception)
    }
}

const updatePickupRequestCount = async (count, pickupRequestId) => {
    try {
        const query = `UPDATE pickup_request SET pending_order_count =  pending_order_count + ?
                       WHERE id = ?;`
        let [rows] = await writeDB.query(query, [count, pickupRequestId]);
        return true;
    } catch (exception) {
        throw new Error(exception.message)
    }
}
const sumOfOrdersInPickup = async (pickupRequstid) => {
    try {
        const query = `SELECT SUM(package_value) totalOrderAmt FROM orders WHERE pickup_request_id = ? ;`;
        const [rows] = await readDB.query(query, [pickupRequstid]);
        return rows;
    } catch (error) {
        throw Error(error)
    }
}

const getContactDetails = async (routeReqAssignedId) => {
    try {
        const query = `SELECT PL.contact_number sellerNumber, U.contact_number riderNumber 
                        FROM route_request_assigned RRA
                        INNER JOIN pickup_request PR ON RRA.pickup_request_id = PR.id
                        INNER JOIN pickup_location PL ON PR.pickup_location_id = PL.id
                        INNER JOIN users U ON RRA.rider_id = U.id
                        WHERE RRA.id = ?;`;

        const [rows] = await readDB.query(query, [routeReqAssignedId]);
        return rows;
    } catch (error) {
        throw Error(error)
    }
}

const getOpenPickupRequestByPincodesOrAll = async (hub_id, pincodes = []) => {
    try {
        let query = `SELECT pr.id, pr.state, pr.pending_order_count, pr.secured_pickup, pr.pickup_request_no, pl.lat, pl.lng, pl.address, pl.pincode, pr.pickup_request_no
                        FROM pickup_request pr
                        INNER JOIN pickup_location pl ON pl.id = pr.pickup_location_id
                        where pr.hub_id = ? AND pr.state = 1 `;
        query += pincodes.length ? ' AND pl.pincode IN (?) ' : '';
        query += 'ORDER BY pr.id DESC  limit 25 ;';
         const [rows] = await readDB.query(query, [hub_id, pincodes]);
         return rows;
    } catch (error) {
        throw error;
    }
}


const getOpenPickupRequestByPincodesOrAllOutSideZone = async (
  hubId,
  pincodes = []
) => {
  try {
    let query = `SELECT pr.id, pr.state, pr.pending_order_count, pr.secured_pickup, pr.pickup_request_no, pl.lat, pl.lng, pl.address, pl.pincode, pr.pickup_request_no
                        FROM pickup_request pr
                        INNER JOIN pickup_location pl ON pl.id = pr.pickup_location_id
                        where pr.hub_id = ? AND pl.pincode NOT IN (?) AND pr.state = 1 ORDER BY pr.id DESC  limit 25 ;`;
    const [rows] = await readDB.query(query, [hubId, pincodes]);
    return rows;
  } catch (error) {
    throw error;
  }
};

const saveAutoAssignLog = async (logData) => {
    try {
        const query = `INSERT INTO auto_assign_log SET ?;`;
        await writeDB.query(query, [logData]);
    } catch (error) {
      throw error;
    }
}



const getPickupReqForAutoAssignByPickupReqNo = async (pickupReqNo) => {
  try {
    const query = `SELECT pr.id, pr.state, pr.pending_order_count, pr.secured_pickup, pr.pickup_request_no, pl.lat, pl.lng, pl.address, pl.pincode, pr.pickup_request_no, pr.hub_id
                        FROM pickup_request pr
                        INNER JOIN pickup_location pl ON pl.id = pr.pickup_location_id
                        where pr.pickup_request_no IN (?) AND pr.state = 1 ORDER BY pr.id DESC  limit 25 ;`;
    const [rows] = await readDB.query(query, [pickupReqNo]);
    return rows;
  } catch (error) {
    throw error;
  }
};


module.exports = {
  getPickupRequestData,
  insertPickupRequest,
  updatePickupRequest,
  checkExistingRider,
  getPickupRequestDataByDBId,
  getPickupRequestId,
  getAlreadyStatusChangedawbs,
  openPickupTripsByPickupReq,
  getOpenPickupReqByPickupLocationExceptCurrent,
  getDeliveryRequestId,
  updateDeliveryRequest,
  getOpenPickupRequests,
  checkIfPickupReqNumExist,
  getRouteReqAndPickupReqByPickuRequestid,
  updatePickupRequestCount,
  sumOfOrdersInPickup,
  getContactDetails,
  getOpenPickupRequestByPincodesOrAll,
  saveAutoAssignLog,
  getOpenPickupRequestByPincodesOrAllOutSideZone,
  getPickupReqForAutoAssignByPickupReqNo
};
