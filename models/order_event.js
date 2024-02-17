"use strict"

const insertOrderEvent = async (fieldNames, insertDataSet = [[]]) => {
    try {
        const [rows] = await writeDB.query(`INSERT INTO order_event (??) VALUES ?`, [fieldNames, insertDataSet]);
        return rows
    } catch (error) {
        console.error(error)
        throw Error(error)
    }
}

const getOrderEvents = async (order_id) => {
    try {
        const [rows] = await writeDB.query(`SELECT * FROM order_event WHERE order_id = ?`, [order_id])
        return rows

    } catch (error) {
        throw Error(error)
    }
}

const getOrderEventsByStatus = async (order_ids, eventsToPush) => {
    try {
        const query = `SELECT O.shypmax_id awb, OE.current_location, OE.status, OE.remarks, OE.event_created_at, OE.event_updated_at, O.source FROM order_event OE INNER JOIN orders O ON O.id = OE.order_id WHERE OE.order_id IN (?) AND OE.status IN (?)`;
        const [rows] = await readDB.query(query, [order_ids, eventsToPush])
        return rows

    } catch (error) {
        throw Error(error)
    }
}

module.exports = {
    insertOrderEvent,
    getOrderEvents,
    getOrderEventsByStatus
}