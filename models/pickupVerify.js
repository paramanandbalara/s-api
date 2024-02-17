
const getPickedAwbCount = async (routeRequestAssignedId , riderId) => {
    try {
        const query = `SELECT RRA.picked_order_count pickup_awb_count, PL.contact_name, PL.contact_number, PL.address, 
                        PL.city, PL.state, PL.pincode, VC.otp_based otp_based_arr, VC.signature_based signature_based_arr, 
                        VC.hub_id config_hub_id, PR.id pickup_request_id, PR.pickup_request_no,RRA.id route_request_assigned_id,
                        PL.seller_id, PR.hub_id, VC.type, VC.status configStatus
                        FROM pickup_request PR
                        INNER JOIN route_request_assigned RRA ON RRA.pickup_request_id = PR.id
                        INNER JOIN pickup_location PL ON PR.pickup_location_id = PL.id
                        LEFT JOIN config VC ON VC.hub_id = PR.hub_id
                        WHERE RRA.id = ? AND RRA.rider_id = ?
                        GROUP BY RRA.id;`
        const [rows] = await readDB.query(query, [routeRequestAssignedId , riderId]);
        
        return rows;

    } catch (exception) {
        throw new Error(exception.message || exception)
    }
}

const getHubId = async (rider_id) => {
    try {
        const query = `SELECT UH.hub_id, U.name FROM user_hub UH JOIN users U ON UH.user_id = U.id WHERE UH.user_id = ?`
        
        const [rows] = await readDB.query(query, [rider_id]);
        
        return rows;

    } catch (exception) {
        throw new Error(exception.message || exception)
    }
}

const getPickupAwbCount = async (route_request_assigned_id) => {
    try {
        const query = `SELECT picked_order_count FROM route_request_assigned WHERE id = ?`
        
        const [rows] = await readDB.query(query, [route_request_assigned_id]);
        
        return rows;

    } catch (exception) {
        throw new Error(exception.message || exception)
    }
}

const getWarehouseDetails = async (warehouse_id) => {
    try {
        const query = `SELECT * FROM pickup_location WHERE id = ?`;
        const [rows] = await readDB.query(query, [warehouse_id]);
        return rows;

    } catch (exception) {
        throw new Error(exception.message || exception)
    }
}

const getPickupSummaryData = async (pickup_request_id) => {
    try {

        let query = ` SELECT awb, shypmax_id, order_number FROM orders WHERE pickup_request_id = ${pickup_request_id} AND status = 4 `
                
        return query;
    } catch (exception) {
        throw new Error(exception.message || exception)
    }
}

const savePickupVerifyOTP = async (insertObj) => {
    try {

        let sql = `INSERT INTO verify_otp SET ?`;
        
        let [rows] = await writeDB.query(sql, [insertObj]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getWarehouseId = async (pickup_request_id) => {
    try {

        let sql = `SELECT PL.sy_warehouse_id, PL.address, PL.city, PL.state, PL.pincode, PL.contact_number, PL.seller_id, PR.hub_id FROM pickup_request PR JOIN pickup_location PL ON PR.pickup_location_id = PL.id WHERE PR.id = ?`;
        
        let [rows] = await readDB.query(sql, [pickup_request_id]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}


const getSellerId = async (pickup_request_id) => {
    try {

        let sql = `SELECT hub_id, seller_id FROM orders WHERE pickup_request_id = ?`;
        
        let [rows] = await readDB.query(sql, [pickup_request_id]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getConfigData = async (hub_id) => {
    try {

        let sql = `SELECT seller_whatsapp_on_pickup, seller_email_on_pickup, status, type FROM config WHERE hub_id = ?;`;
        
        let [rows] = await readDB.query(sql, [hub_id]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}



module.exports = { getPickedAwbCount, getWarehouseDetails, getPickupSummaryData, getHubId, savePickupVerifyOTP, getWarehouseId, getPickupAwbCount, getSellerId, getConfigData }
