"use strict";

const addStock = async ( insert_obj ) => {
    try {

        let sql = `INSERT INTO bag_seal_inventory SET ?`;
        
        let [rows] = await writeDB.query(sql, [insert_obj]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}

const editStock = async ( update_obj, id ) => {
    try {

        const query = `UPDATE bag_seal_inventory SET ? WHERE id = ? `

        const [result] = await writeDB.query(query, [update_obj, id])

        return true;

    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getStockData = async (offset , limit , filters) => {
    try {
        console.log(filters)
        let query = `SELECT HD.name, HD.code, HD.city, HD.address, BSI.bag_count, BSI.seal_count, BSI.id, BSI.stock_added_date, BSI.hub_id
                 FROM hub_details HD
                 INNER JOIN bag_seal_inventory BSI ON HD.id = BSI.hub_id 
                 WHERE 1`

        if(filters?.hub_code)
            query += ` AND HD.code = '${filters?.hub_code}'`

        if(filters?.hub_city)
            query += ` AND HD.city = '${filters?.hub_city}'`

        query += ` ORDER BY BSI.stock_added_date DESC LIMIT ?,?`

        const [rows] = await readDB.query(query, [offset, limit]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message || exception)
    }
}

const getStockDataByID = async (stock_id) => {
    try {
        let query = `SELECT HD.name, HD.code, HD.city, HD.address, BSI.bag_count, BSI.seal_count, BSI.id, BSI.stock_added_date, BSI.hub_id
                 FROM bag_seal_inventory BSI
                 INNER JOIN hub_details HD ON HD.id = BSI.hub_id 
                 WHERE BSI.id = ?`

        const [rows] = await readDB.query(query, [stock_id]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message || exception)
    }
}

const getInventoryData = async (id) => {
    try {

        let query = `SELECT bag_count bag_count_db, seal_count seal_count_db, hub_id FROM bag_seal_inventory WHERE id = ?`

        const [rows] = await readDB.query(query, [id]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message || exception)
    }
}


module.exports = { addStock, editStock, getStockData, getInventoryData, getStockDataByID};