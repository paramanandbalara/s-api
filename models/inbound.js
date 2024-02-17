'use strict'
const dayjs = require('dayjs');

const getInboubdBagDetails = async (code) => {
    try {
        const query = `SELECT bag_details.*, COUNT(orders.id) as expected_awb_count, hub_details.code as hub_code FROM bag_details
                        LEFT JOIN orders ON orders.bag_id = bag_details.id 
                        INNER JOIN hub_details ON hub_details.id = bag_details.hub_id
                        WHERE (bag_details.bag_code = ? OR bag_details.bag_sealno = ?)
                        GROUP BY orders.hub_id
                        ORDER BY orders.hub_id;`

        const [rows] = await readDB.query(query, [code, code]);

        return rows;

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const update_bag = async (code, data) => {
    try {
        const query = `UPDATE bag_details SET ? WHERE (bag_details.bag_code = ? OR bag_sealno = ?);`

        const [rows] = await writeDB.query(query, [data, code, code])
        return rows;

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const inbound_awb_count = async (bag_id, inbound_status) => {
    try {
        const query = `SELECT COUNT(id) as inbound_awb_count from orders WHERE bag_id = ? AND status = ?;`

        const [rows] = await readDB.query(query, [bag_id, inbound_status]);

        return rows[0];

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}


const inboundAwbCount = async (bag_id, inbound_status) => {
    try {
        const query = `SELECT bag_id, COUNT(id) as expected_awb_count from orders WHERE bag_id IN (?) AND status = ? GROUP BY bag_id;`

        const [rows] = await readDB.query(query, [bag_id, inbound_status]);

        return rows;

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const getAwbCountByBagId = async (bagId, status) => {
    try {
        let query = `SELECT bag_id, COUNT(id) as orderCount from orders WHERE bag_id IN (?) `
        if (status) query += 'AND status = ?'
        query +=' GROUP BY bag_id;';
        const [rows] = await readDB.query(query, [bagId, status]);
        return rows;

    } catch (exception) {
        console.error(exception);
        throw exception;
    }
}

const getOrderDetailsByLMAndbag = async (awb, bag_id) => {
    try {
        const query = `SELECT * FROM orders WHERE awb = ? AND bag_id = ?;`
        const [rows] = await readDB.query(query, [awb, bag_id]);
        return rows;
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message)
    }
}

const getMissingOrder = async (bag_id, inbound_status) => {
    try {
        const query = `SELECT * FROM orders WHERE bag_id = ? AND status != ?;`
        const [rows] = await readDB.query(query, [bag_id, inbound_status]);
        return rows;
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message)
    }
}


const inboundBagsList = async (gateway_id, offset, limit) => {
    try {
       // bag_state = 3 -- Inbound Complete at Gateway
        const query = `SELECT bag_details.bag_code, bag_details.bag_sealno, bag_details.id,
                        hub_details.code as hub_code, 
                        COUNT(orders.id) as expected_awb_count 
                        FROM bag_details
                        LEFT JOIN orders ON orders.bag_id = bag_details.id 
                        INNER JOIN hub_details ON hub_details.id = bag_details.hub_id
                        WHERE bag_details.bag_state = 3 
                        AND bag_details.gateway_id = ? 
                        AND bag_details.gateway_inscan_date >= NOW() - INTERVAL 2 DAY
                        GROUP BY orders.bag_id ORDER BY bag_details.gateway_inscan_date DESC LIMIT ?,?;`;
        const [rows] = await readDB.query(query, [gateway_id, offset, limit]);
        return rows;
    } catch (exception) {
        console.error(exception);
        throw exception
    }
}

const getInboundExportData = async ({startDate, endDate}, gateway_id) => {
    try {
        startDate = dayjs(startDate).format('YYYY-MM-DD 00:00:00');
        endDate = dayjs(endDate).format('YYYY-MM-DD 23:59:59');
        // bag_state = 3 -- Inbound Complete at Gateway
        let query = `SELECT O.awb, O.status, 
                        BD.id, BD.bag_code, BD.bag_sealno, BD.bag_date, BD.bag_weight, BD.gateway_inscan_date, BD.gateway_inscan_date, BD.transporter_awbno, BD.outscan_date,
                        hub_details.code as hub_code
                        FROM orders O 
                        INNER JOIN bag_details BD ON O.bag_id = BD.id
                        INNER JOIN hub_details ON hub_details.id = BD.hub_id
                        WHERE BD.gateway_id = ? 
                        AND BD.bag_state = 3 
                        AND BD.gateway_inscan_date BETWEEN ? AND ?
                        GROUP BY O.id;`;
        return readDB.format(query, [gateway_id, startDate, endDate]);
    }
    catch (exception) {
        console.error(exception);
        throw exception;
    }
}

const getInboundBagID = async (gateway_id, {startDate, endDate} = {} ) => {
    try {
        // bag_state = 3 -- Inbound Complete at Gateway
        let query = `SELECT BD.id
                        FROM orders O 
                        INNER JOIN bag_details BD ON O.bag_id = BD.id
                        INNER JOIN hub_details ON hub_details.id = BD.hub_id
                        WHERE BD.gateway_id = ? AND BD.bag_state = 3`;
        if (startDate && endDate) {
            startDate = dayjs(startDate).format('YYYY-MM-DD 00:00:00');
            endDate = dayjs(endDate).format('YYYY-MM-DD 23:59:59');
            query += ` AND BD.gateway_inscan_date BETWEEN ? AND ?`;
        }
        else{
            query += ` AND BD.gateway_inscan_date >= NOW() - INTERVAL 2 DAY`
        }
        query += ` GROUP BY O.id;`;
        const [rows] = await readDB.query(query, [gateway_id, startDate, endDate]) 
        return rows
    }
    catch(exception){
        console.error(exception);
        throw exception;
    }
}

const droppedOffList = async ({ limit, offset, hubId, startDate, endDate }) => {
    try {
        const query = `SELECT O.shypmax_id, O.awb, O.seller_id,
                        HD.code, HD.city, PL.company_name,
                        OE.event_created_at as drop_off_date
                        FROM order_event OE
                        INNER JOIN orders O ON OE.awb = O.awb
                        INNER JOIN hub_details HD ON O.hub_id = HD.id
                        INNER JOIN pickup_location PL ON O.sy_warehouse_id = PL.sy_warehouse_id
                        WHERE OE.status = 18 AND O.dropoff_hub_id = ? AND OE.event_created_at BETWEEN ? AND ? 
                        ORDER BY OE.event_created_at DESC LIMIT ?, ?;`
        const [rows] = await readDB.query(query, [hubId, startDate, endDate, offset, limit]);
        return rows;
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message)
    }
}


const getDropOffExport = async (startDate, endDate, hub_id) => {
    try {
        let arr = [];

        let query = ` SELECT O.shypmax_id, O.awb, O.seller_id, 
                        HD.code, HD.city, PL.company_name,
                        OE.event_created_at 
                        FROM order_event OE
                        INNER JOIN orders O ON OE.awb = O.awb
                        INNER JOIN hub_details HD ON O.hub_id = HD.id
                        INNER JOIN pickup_location PL ON O.sy_warehouse_id = PL.sy_warehouse_id
                        WHERE OE.status = 18`
        if (hub_id) {
            query += ` AND O.dropoff_hub_id = ?`
            arr.push(hub_id)
        }

        if (startDate && endDate) {
            query += ` AND OE.event_created_at BETWEEN ? AND ?`;
            arr.push(dayjs(startDate).format('YYYY-MM-DD 00:00:00'), dayjs(endDate).format('YYYY-MM-DD 23:59:59'))
        }
        return { query, arr };

    } catch (exception) {
        throw new Error(exception.message)
    }
}

module.exports = {
    getInboubdBagDetails,
    update_bag,
    inbound_awb_count,
    getOrderDetailsByLMAndbag,
    getMissingOrder,
    inboundBagsList,
    getInboundExportData,
    droppedOffList,
    inboundAwbCount,
    getDropOffExport,
    getInboundBagID,
    getAwbCountByBagId
}