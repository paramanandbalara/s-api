"use strict"

const getHubDetailsByPincode = async (pinCode) => {
    try {
        const [rows] = await readDB.query(`SELECT hp.hub_id,h.cutoff_time 
        FROM hub_pincode_mapping hp
        JOIN hub_details h ON h.id = hp.hub_id
        WHERE hp.is_active = 1 AND h.status = 1 AND hp.pincode = ?`, [pinCode])
        return rows

    } catch (error) {
        throw Error(error)
    }
}

const getPincodeExport = async (hubId) => {
    try {
        const query = `SELECT HPM.pincode, HD.code
                     FROM hub_pincode_mapping HPM 
                     INNER JOIN hub_details HD ON HPM.hub_id = HD.id 
                     WHERE HD.id IN (?)`
        return readDB.format(query,[hubId])
    } catch (error) {
        throw Error(error)
    }
}
const getHubDetailsByPincodeAndStatus = async (pinCode, status) => {
    try {
        
        const [rows] = await readDB.query(
          `SELECT hp.hub_id, h.cutoff_time, h.secure_pickup
        FROM hub_pincode_mapping hp
        JOIN hub_details h ON h.id = hp.hub_id
        WHERE hp.is_active = 1 AND h.status IN (?) AND hp.pincode = ?`,
          [status, pinCode]
        );
        return rows;

    } catch (error) {
        throw Error(error)
    }
}

const getMatchedPincodes = async (pincodes) => {
    try {
        const query = `SELECT hpm.pincode, hpm.hub_id, hd.status as hub_status FROM hub_pincode_mapping hpm
		                JOIN hub_details  hd
		                ON hd.id = hpm.hub_id
		                WHERE hpm.pincode IN (?) AND hd.status <> 0`

        const [rows] = await readDB.query(query, [pincodes])
        return rows;

    } catch (exception) {
        console.error(exception)
        throw new Error(exception.messagge || exception)
    }
}

const getServiciableDataByPincodes = async (pincodes) => {
    try {
        const query = `SELECT HPM.hub_id, HPM.pincode, HD.code FROM hub_pincode_mapping HPM
                        INNER JOIN hub_details HD ON HPM.hub_id = HD.id
                        WHERE HPM.pincode IN (?);`

        const [rows] = await readDB.query(query, [pincodes])
        return rows;

    } catch (exception) {
        console.error(exception)
        throw new Error(exception.messagge || exception)
    }
}

const getPincodeByHubId = async (hubId) => {
    try {
        const query = `SELECT pincode
                     FROM hub_pincode_mapping  
                     WHERE hub_id = ?`
        const [rows] = await readDB.query(query, [hubId])
        return rows;
    } catch (error) {
        throw Error(error)
    }
}

module.exports = { getHubDetailsByPincode, getMatchedPincodes, getHubDetailsByPincodeAndStatus, getPincodeExport, getServiciableDataByPincodes, getPincodeByHubId }
