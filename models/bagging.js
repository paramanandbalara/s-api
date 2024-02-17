const { query } = require("express");

const getBagsByHubId = async ({ hub_id, bag_state, list = false, type = [1, 2], offset, limit }) => {
    try {
        let sql = ``
        if (list) {
            sql = `AND bd.outscan_date IS NULL`
        }

        let query = `SELECT bd.id, bd.bag_code, bd.bag_state, bd.hub_id, bd.scan_by, bd.gateway_id, bd.bag_date,  bd.created, bd.type, bd.bag_type,
                        bd.bag_sealno, bd.bag_weight, bd.bag_length, bd.bag_width, bd.bag_height,
                        COUNT(od.id) as awb_count, hd.code as main_gateway, hd.city as hub_city
                        FROM bag_details bd 
                        LEFT JOIN orders od ON od.bag_id = bd.id
                        INNER JOIN hub_details hd ON hd.id = bd.gateway_id
                        WHERE bd.hub_id = ? AND bag_state IN (?) ${sql} AND bd.type IN (?)
                        GROUP BY bd.id
                        ORDER BY bd.id DESC `;
        if (list) {
            query += ` LIMIT ?,?;`
        }
        const [rows] = await readDB.query(query, [hub_id, bag_state, type, offset, limit]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message || exception)
    }
}


const getLastBagByHubId = async ({ hub_id, bagType = null, pickupDelivery }) => {
    try {
        const queryParams = [hub_id, pickupDelivery]
        let query = `SELECT bd.id, bd.bag_code, bd.bag_state, bd.hub_id,  bd.gateway_id, bd.type, bd.bag_type
                        FROM bag_details bd 
                        WHERE bd.hub_id = ? AND type = ? `
        if (bagType) {
            query += ' AND bd.bag_type = ? '
            queryParams.push(bagType)
        }
        query += ' ORDER BY bd.id DESC LIMIT 1';
        const [rows] = await readDB.query(query, queryParams);

        return rows;

    } catch (exception) {
        throw exception;
    }
}

const getBagsByGatewayId = async ({ gatewayId, bag_state, bagType = null, pickupDelivery }) => {
    try {
        const queryParams = [gatewayId, bag_state, pickupDelivery]
        let query = `SELECT bd.id, bd.bag_code, bd.bag_state, bd.hub_id, bd.scan_by, bd.gateway_id, bd.bag_date, bd.created, bd.type, bd.bag_type,
                        COUNT(od.id) as awb_count, hd.code as main_gateway, hd.city as hub_city
                    FROM bag_details bd
                    LEFT JOIN orders od ON od.bag_id = bd.id
                    INNER JOIN hub_details hd ON hd.id = bd.gateway_id
                    WHERE bd.gateway_id = ? AND bd.bag_state IN (?) AND bd.type = ? `

        if (bagType) {
            query += ' AND bd.bag_type = ? '
            queryParams.push(bagType)
        }
        query += ` GROUP BY bd.id 
                    ORDER BY bd.created DESC;`;
        const [rows] = await readDB.query(query, queryParams);

        return rows;

    } catch (exception) {
        throw exception;
    }
}

const saveNewBag = async (bag_data) => {
    try {
        const [rows] = await writeDB.query(`INSERT INTO bag_details SET ?`, [bag_data]);

        return rows;

    } catch (exception) {
        throw exception;
    }
}

const updateBagDetails = async (bag_ids_arr, bag_data) => {
    try {
        const [rows] = await writeDB.query(`UPDATE bag_details SET ? WHERE id IN (?)`, [bag_data, bag_ids_arr]);

        return rows;

    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message || exception)
    }
}
const updateBagDetailsbyTransportrAwb = async (temoTransporterAirwayBill, updateData) => {
    try {
        const [rows] = await writeDB.query(`UPDATE bag_details SET ? WHERE transporter_awbno = ?;`, [updateData, temoTransporterAirwayBill]);
        return rows;

    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message || exception)
    }
}

const closeBag = async (bag_id, bag_data) => {
    try {
        const [rows] = await writeDB.query(`UPDATE bag_details SET ? WHERE id = ?;`, [bag_data, bag_id]);

        return rows;

    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message || exception)
    }
}

const getBagsByBagcode = async (bag_code_arr) => {
    try {
        //TODO replace * with ?? and passed required column name from calling function
        const [rows] = await readDB.query(`SELECT * from bag_details WHERE ( bag_code IN (?) OR bag_sealno IN (?) );`, [bag_code_arr, bag_code_arr]);
        // const [rows] = await readDB.query(`SELECT * from bag_details WHERE  bag_sealno IN (?);`, [bag_code_arr]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message || exception)
    }
}

const transporterList = async (hub_id) => {
    try {
        const [rows] = await readDB.query(`SELECT * from transporter WHERE hub_id = ?`, [hub_id]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message || exception)
    }
}

const getOutScanedBags = async (hub_id, offset, limit) => {
    try {
        const query = `SELECT bd.id, bd.bag_code, bd.bag_sealno, bd.bag_date, bd.bag_weight, bd.transporter_id, bd.bag_type,
                            bd.gateway_id, bd.gateway_inscan_date, bd.outscan_date,
                            CASE WHEN bd.transporter_awbno LIKE 'temp-airway-%' THEN NULL ELSE bd.transporter_awbno END AS transporter_awbno,
                            (bd.transporter_awbno LIKE 'temp-airway-%') AS bag_edit,
                            COUNT(o.id) AS awb_count,
                            t.name AS transporter_name
                        FROM bag_details bd
                        INNER JOIN orders o ON o.bag_id = bd.id
                        INNER JOIN transporter t On bd.transporter_id = t.id
                        WHERE bd.hub_id = ?
                        AND (bd.gateway_inscan_date IS NULL OR bd.transporter_awbno LIKE 'temp-airway-%')
                        GROUP BY bd.id
                        ORDER BY bd.outscan_date DESC 
                        LIMIT ?,?;`

        const [rows] = await readDB.query(query, [hub_id, offset, limit]);

        return rows;

    } catch (exception) {
        throw new Error(exception.message || exception)
    }
}


const getBagDetailsById = async (bag_id) => {
    try {
        const [rows] = await readDB.query(`SELECT * from bag_details WHERE id = ?`, [bag_id]);

        return rows;
    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message)
    }
}

const getBagDetailsBySealNo = async (bag_sealno) => {
    try {
        const [rows] = await readDB.query(`SELECT * from bag_details WHERE bag_sealno = ?`, [bag_sealno]);

        return rows;
    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message)
    }
}


const checkTransporterAwb = async (transporter_awbno) => {
    try {
        const [rows] = await readDB.query(`SELECT * from bag_details WHERE transporter_awbno = ?`, [transporter_awbno]);

        return rows;
    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message)
    }
}

const bagLabelData = async (bag_id) => {
    try {

        const query = `SELECT bag_details.*, COUNT(orders.id) as awb_count, hub_details.address, hub_details.city, hub_details.state FROM bag_details 
                        LEFT JOIN orders ON orders.bag_id = bag_details.id
                        INNER JOIN hub_details ON hub_details.id = bag_details.gateway_id
                        WHERE bag_details.id = ?
                        GROUP BY orders.bag_id;`;

        const [rows] = await readDB.query(query, [bag_id]);

        return rows;
    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message)
    }
}

const getOrderListByBagId = async (bag_id) => {
    try {
        const query = `SELECT * FROM orders WHERE bag_id = ?`;

        const [rows] = await readDB.query(query, [bag_id]);

        return rows;
    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message)
    }
}
const getBagDetailsAndCount = async (bag_id) => {
    try {
        const query = `SELECT bag_details.*, COUNT(orders.id) as awb_count,  hub_details.code as main_gateway
                        FROM bag_details 
                        LEFT JOIN orders ON orders.bag_id = bag_details.id
                        INNER JOIN hub_details ON hub_details.id = bag_details.gateway_id
                        WHERE bag_details.id = ?`;

        const [rows] = await readDB.query(query, [bag_id]);

        return rows;
    } catch (exception) {
        console.error(exception)
        throw exception;
    }

}


const getDeliveryBagByGatewayAndHubId = async (gatewayId, hubId, bagType) => {
    try {
        const query = `SELECT bd.id, bd.bag_state, bd.hub_id, bd.type, bd.bag_type
                                        FROM bag_details bd
                                        WHERE bd.gateway_id = ? AND bd.hub_id = ? AND bd.bag_state = 1 AND bd.type = 2  AND bd.bag_type = ? ORDER BY bd.created DESC LIMIT 1;`;
        const [rows] = await readDB.query(query, [gatewayId, hubId, bagType]);
        return rows;

    } catch (exception) {
        console.error(exception)
        throw exception;
    }

}

module.exports = {
    getBagsByHubId,
    saveNewBag,
    updateBagDetails,
    getBagsByBagcode,
    transporterList,
    closeBag,
    getOutScanedBags,
    getBagDetailsById,
    getBagDetailsBySealNo,
    checkTransporterAwb,
    bagLabelData,
    getOrderListByBagId,
    getBagDetailsAndCount,
    getBagsByGatewayId,
    updateBagDetailsbyTransportrAwb,
    getLastBagByHubId,
    getDeliveryBagByGatewayAndHubId
}