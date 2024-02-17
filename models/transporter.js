"use strict";

const addTransporter = async ( insert_obj ) => {
    try {

        let sql = `INSERT INTO transporter SET ?`;
        
        let [rows] = await writeDB.query(sql, [insert_obj]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message)
    }
}

const editTransporter = async ( id, update_obj ) => {
    try {

        const query = `UPDATE transporter SET ? WHERE id = ? `

        const [result] = await writeDB.query(query, [update_obj, id])

        return true;

    } catch (exception) {
        throw new Error(exception.message)
    }
}

const transporterList = async (offset, limit, id = null, filters) => {
    try {
        let query = `SELECT transporter.name, transporter.mode, transporter.created , transporter.id, transporter.hub_id, hub_details.name hub_name, hub_details.code, hub_details.city 
                     from transporter  
                     JOIN hub_details ON transporter.hub_id = hub_details.id
                     WHERE 1 `

        if(id) {
            query += ` AND transporter.id = ?`
        }

        if(filters?.hub_code) {
            query += ` AND hub_details.code = '${filters.hub_code}'`
        }

        if(filters?.hub_city) {
            query += ` AND hub_details.city = '${filters.hub_city}'`
        }

        if(limit){
            query += ` ORDER BY transporter.id DESC LIMIT  ${offset}, ${limit}`
        }

        const [rows] = await readDB.query(query, [id]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message || exception)
    }
}


module.exports = { addTransporter, transporterList, editTransporter };