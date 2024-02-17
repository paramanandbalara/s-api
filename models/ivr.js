
"use strict";


const checkAlreadyCallInitiatedData = async (sourceNumber, destinationNumber) => {
    try {
        const query = ` SELECT call_source, call_destination
                        FROM call_log
                        WHERE call_date >= NOW() - INTERVAL 30 SECOND AND call_source = ? AND call_destination = ?;`
        const [rows] = await readDB.query(query, [sourceNumber, destinationNumber]);
        return rows;
    } catch (exception) {
        console.error(__line, exception);
        throw exception;
    }
}

const insertIVRData = async (ivrObject) => {
    try {
        const sql = `INSERT INTO call_log SET ?;`;
        const [rows] = await writeDB.query(sql, [ivrObject]);
        return rows;
    }
    catch (exception) {
        console.error(__line, exception);
        throw exception;
    }
}


module.exports = { checkAlreadyCallInitiatedData, insertIVRData }