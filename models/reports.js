"use strict";

const getAllReportList = async () => {
    try {
        const query = `SELECT id, name FROM fav_setting;`;
        const [rows] = await readDB.query(query);
        return rows;
    } catch (error) {
        throw error;
    }
}

module.exports = { getAllReportList }