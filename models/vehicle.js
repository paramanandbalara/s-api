"use strict";


const vehicleList = async ( offset, limit ) => {
    try {

        let sql = `SELECT * FROM vehicle_master ORDER BY id DESC LIMIT ?,?`;
        
        let [rows] = await readDB.query(sql, [offset, limit]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getSinglevehicleData = async ( id ) => {
    try {
        let sql = `SELECT * FROM vehicle_master WHERE id = ?`;
        
        let [rows] = await readDB.query(sql, [id]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}


const addVehicle = async ( insert_obj ) => {
    try {

        let sql = `INSERT INTO vehicle_master SET ?`;
        
        let [rows] = await writeDB.query(sql, [insert_obj]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}

const editVehicle = async ( update_obj, id ) => {
    try {

        let sql = `UPDATE vehicle_master SET ? WHERE id = ?`;
        
        let [rows] = await writeDB.query(sql, [update_obj, id]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getAllVehicleList = async () => {
    try {
        let sql = `SELECT id, vehicle_type, max_weight  FROM vehicle_master`;
        let [rows] = await readDB.query(sql);
        return rows;
    } catch (exception) {
        console.error(exception);
        throw exception;
    }
}




module.exports = { addVehicle, vehicleList, getSinglevehicleData, editVehicle, getAllVehicleList };