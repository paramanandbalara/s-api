"use strict";
const dayjs = require("dayjs")

const saveCheckInCheckOutStatus = async ( insertObj ) => {
    try {

        let sql = `INSERT INTO rider_checkin_checkout SET ?`;
        
        let [rows] = await writeDB.query(sql, [insertObj]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}



const getRiderCheckInStatus = async(user_id) => {
    try {

        let sql = `SELECT * FROM rider_checkin_checkout WHERE user_id = ? ORDER BY created DESC LIMIT 1`;

        let [rows] = await readDB.query(sql, [user_id]);

        return rows;

    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message)
    }
}

const updateRiderCheckInStatus = async (id, updateObj) => {
    try {

        let sql = `UPDATE  rider_checkin_checkout SET ? WHERE id = ?`;

        let [rows] = await writeDB.query(sql, [updateObj, id]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getRiderTimeline = async ( rider_id ) => {
    try {

        let sql = `SELECT PR.pickup_date, PR.verified_lat, PR.verified_long, PL.address, PL.state, PL.city, PL.pincode, U.name
                   FROM pickup_request PR 
                   JOIN pickup_location PL on PR.pickup_location_id = PL.id 
                   LEFT JOIN route_request_assigned RRA ON PR.id = RRA.pickup_request_id
                   LEFT JOIN users U ON RRA.rider_id = U.id
                   WHERE RRA.rider_id = ?
                   AND PR.created BETWEEN '${dayjs(new Date).format('YYYY-MM-DD 00:00:00')}' AND '${dayjs(new Date).format('YYYY-MM-DD 23:59:59')}'`;

        let [rows] = await readDB.query(sql, [rider_id]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getCheckinCheckoutData = async (filters, user_id, offset, limit, isExport = false) => {
    try {

        let query = `SELECT RCC.created, RCC.user_id, RCC.id, RCC.checkin_date, RCC.checkin_odometer_reading, RCC.checkout_date, RCC.checkout_odometer_reading,
                     HD.city, HD.state, U.name rider_name, U.id rider_id
                     FROM rider_checkin_checkout RCC 
                     JOIN user_hub UH ON RCC.user_id = UH.user_id
                     JOIN users U ON RCC.user_id = U.id
                     LEFT JOIN hub_details HD ON UH.hub_id = HD.id 
                     WHERE 1`

        if (filters?.rider_id) {
            query += ` AND RCC.user_id = '${filters?.rider_id}'`;
        }

        if (filters?.startDate && filters?.endDate) {
            query += ` AND RCC.created >= '${dayjs(filters?.startDate).format('YYYY-MM-DD 00:00:00')}' AND RCC.created <= '${dayjs(filters?.endDate).format('YYYY-MM-DD 23:59:59')}'`;
        }

        if(!isExport){

            query += ` ORDER BY RCC.created DESC LIMIT ?,?`;
        }
        else{
            query += ` ORDER BY RCC.created DESC`
        }

        if(isExport == true){
            return query
        }

        const [rows] = await readDB.query(query, [offset, limit]);
        
        return rows;
    } catch (exception) {
        console.log(exception)
        throw new Error(exception.message)
    }
}

const getCheckinImageData = async (id) => {
    try {
        let query = `SELECT * FROM rider_checkin_checkout WHERE id = ?`

        const [rows] = await readDB.query(query, [id]);
        
        return rows;
    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getActiveRiders = async (startDate, endDate) => {
    try {
        let query = `SELECT COUNT(DISTINCT UH.user_id) activeRidersCount
                        FROM user_hub UH
                        JOIN users U on U.id = UH.user_id
                        JOIN rider_checkin_checkout RCC on RCC.user_id=U.id
                        WHERE U.role_id = 2 AND RCC.checkin_date >= ? AND RCC.checkin_date <= ?`

        const [rows] = await readDB.query(query,[startDate, endDate]);

        if (!rows.length) return [{ activeRidersCount: 0 }];
        
        return rows;
    } catch (exception) {
        throw new Error(exception)
    }
}



module.exports = { saveCheckInCheckOutStatus, getRiderCheckInStatus, updateRiderCheckInStatus, getRiderTimeline, getCheckinCheckoutData, getCheckinImageData, getActiveRiders };
