
"use strict";

const dayjs = require('dayjs')


const getLinehaulData = async ({ startDate, endDate, offset, limit }, isExport = false) => {
    try {
        startDate = dayjs(startDate || new Date()).format('YYYY-MM-DD 00:00:00');
        endDate = dayjs(endDate || new Date()).format('YYYY-MM-DD 23:59:59');

        const sqlArr = [];
        let query = `SELECT BD.id, HD.code hub_code, HD.city hub_city, HD.gateway_code, BD.bag_weight,
                  T.name transporter_name, T.mode transporter_mode,
                  BD.transporter_awbno, BD.outscan_date, BD.gateway_inscan_date inbound_date
                  FROM bag_details BD
                  INNER JOIN transporter T ON BD.transporter_id = T.id
                  INNER JOIN hub_details HD ON BD.hub_id = HD.id 
                  WHERE BD.outscan_date BETWEEN ? AND ? ORDER BY BD.outscan_date DESC`;
        sqlArr.push(startDate, endDate);
        if (isExport) return readDB.format(query, sqlArr);

        if (limit) {
            query += ` LIMIT ?, ?;`;
            sqlArr.push(offset, limit);
        }

        const [rows] = await readDB.query(query, sqlArr);
        return rows;
    } catch (exception) {
        throw exception;
    }
}


const getTransporterAWBDetails = async (bagIds) => {
    try {

        let query = ` SELECT BD.bag_code, BD.bag_sealno, SUM(O.package_value) total_value, BD.bag_weight, BD.bag_length, BD.bag_width, BD.bag_height
                        FROM orders O
                        LEFT JOIN bag_details BD ON O.bag_id = BD.id
                        WHERE BD.id IN (?) GROUP BY O.bag_id;`

        const [rows] = await readDB.query(query, [bagIds]);

        return rows;

    } catch (exception) {
        console.error(__line, exception);
        throw exception;
    }
}


module.exports = { getLinehaulData, getTransporterAWBDetails }