"use strict"

const getEventDetailsByEventName = async (eventName) => {
    try {
        const query = `SELECT * FROM notification WHERE event_name = ? AND status = 1`
        const [rows] = await readDB.query(query, [eventName]);
        return rows
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

module.exports = {
    getEventDetailsByEventName
}