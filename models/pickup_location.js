"use strict"

const savePickupLocation = async ( dataSet ) => {
    try {

        const [rows] = await writeDB.query(`INSERT INTO pickup_location SET ?`, [dataSet])
        return rows

    } catch (exception) {
        console.log(__line,exception)
        throw new Error(exception.message || exception)
    }
}

const getPickupLocationDetails = async ( sy_warehouse_id ) => {
    try {
        const [rows] = await readDB.query(`SELECT id, address, city, pincode, state, lat, lng FROM pickup_location WHERE sy_warehouse_id = ?`,[sy_warehouse_id])
        return rows

    } catch (exception) {
        console.log(exception)
        throw new Error(exception.message || exception)
    }
}

const getPickupRiderData = async (id) => {
    try {
        const [rows] = await readDB.query(`SELECT  U.name, O.awb, PR.pickup_date, O.manifest_id
                                           FROM orders O 
                                           LEFT JOIN pickup_request PR ON PR.id = O.pickup_request_id 
                                           LEFT JOIN route_request_assigned RRA ON RRA.id =  O.route_request_assigned_id  
                                           LEFT JOIN users U ON RRA.rider_id = U.id 
                                           WHERE O.id = ?`,[id])

        return rows;

    } catch (exception) {
        console.log(exception)
        throw new Error(exception.message || exception)
    }
}


const updatePickupLocationById = async (pickup_location_id, warehouse_data) => {
    try {
        const [rows] = await writeDB.query(`UPDATE pickup_location SET ? WHERE id = ?`, [warehouse_data, pickup_location_id])
        return rows;
    } catch (exception) {
        console.log(exception)
        throw new Error(exception.message || exception)
    }
}

const updateLatLongInDb = async (rowId, tableName, updateData) => {
    try {
        const query = `UPDATE ?? SET ? WHERE id = ?`
        const [rows] = await writeDB.query(query, [tableName, updateData, rowId])
        return rows;
    } catch (exception) {
        console.log(exception)
        throw new Error(exception.message || exception)
    }
}
module.exports = {
    savePickupLocation,
    getPickupLocationDetails,
    getPickupRiderData,
    updatePickupLocationById,
    updateLatLongInDb
}