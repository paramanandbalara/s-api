'use strict';
const dayjs = require('dayjs');

const getHubByCode = async (code) => {
  try {
    const query = `SELECT * from hub_details WHERE code IN (?);`; // to do remove *

    const [rows] = await readDB.query(query, [code]);
    return rows;
  } catch (exception) {
    throw exception;
  }
};

const getHubByGatewayCode = async (code) => {
  try {
    const query = `SELECT * from hub_details WHERE gateway_code IN (?)`;

    const [rows] = await readDB.query(query, [code]);
    return rows;
  } catch (exception) {
    throw exception;
  }
};

const saveHub = async (data) => {
  try {
    const [rows] = await writeDB.query(`INSERT INTO hub_details SET ?`, [data]);
    return rows;
  } catch (exception) {
    throw exception;
  }
};

const getAllHubUsers = async (
  offset,
  limit,
  hub_code,
  hub_city,
  role_id,
  contact_no,
) => {
  try {
    let query = `SELECT COUNT(users.id) AS hubCount,users.id, users.name, users.email ,  users.contact_number , users.vehicle_number , users.address , roles.role as role, users.status,
        users.created, hub_details.city as hub_city, hub_details.code as hub_code, users.app_access 
        FROM users 
        LEFT JOIN user_hub ON users.id = user_hub.user_id
        LEFT JOIN hub_details ON hub_details.id = user_hub.hub_id
        JOIN roles ON users.role_id = roles.id 
        WHERE 1 AND ( user_hub.hub_id IN (SELECT DISTINCT(hub_id) FROM user_hub) OR (users.id NOT IN(SELECT DISTINCT(user_id) FROM user_hub)))`;

    if (hub_code) {
      query += ` AND hub_details.code = '${hub_code}'`;
    }
    if (hub_city) {
      query += ` AND hub_details.city = '${hub_city}'`;
    }
    if (role_id) {
      query += ` AND roles.id = '${role_id}'`;
    }
    if (contact_no) {
      query += ` AND users.contact_number = '${contact_no}'`;
    }

    query += ` GROUP BY users.id ORDER BY users.id DESC LIMIT ?,?;`;

    const [rows] = await readDB.query(query, [offset, limit]);
    return rows;
  } catch (exception) {
    throw exception;
  }
};

const getAllHubs = async (
  offset,
  limit,
  is_pagination,
  gateway = false,
  connection_hub = false,
  hub_code,
  hub_city,
) => {
  try {
    let query = `SELECT * FROM hub_details WHERE 1 `;
    if (gateway) {
      query += ` AND status IN (1, 2, 3)  AND type = 1 `;
    }
    if (connection_hub) {
      query += ` AND status IN (1, 2, 3) AND type = 2 `;
    }
    if (hub_code) {
      query += ` AND code = '${hub_code}'`;
    }
    if (hub_city) {
      query += ` AND city = '${hub_city}'`;
    }

    if (is_pagination == `true`) {
      query += ` ORDER BY status DESC, created DESC LIMIT ${offset},${limit}`;
    }

    const [rows] = await readDB.query(query);
    return rows;
  } catch (exception) {
    throw exception;
  }
};

const getCityWiseHubs = async (city) => {
  try {
    const query = `SELECT * FROM hub_details WHERE city IN (?)`;
    const [rows] = await readDB.query(query, [city]);
    return rows;
  } catch (exception) {
    throw exception;
  }
};

const editHubDetails = async (id, update_obj) => {
  try {
    const query = `UPDATE hub_details SET ? WHERE id = ?;`;
    let [rows] = await writeDB.query(query, [update_obj, id]);
    return true;
  } catch (exception) {
    throw exception;
  }
};

const getHubDetailsById = async (id) => {
  try {
    const query = `SELECT * FROM hub_details WHERE id = ?;`;
    let [rows] = await readDB.query(query, [id]);
    return rows[0];
  } catch (exception) {
    throw exception;
  }
};

const getCities = async () => {
  try {
    const query = `SELECT DISTINCT city FROM hub_details;`;
    let [rows] = await readDB.query(query);
    return rows;
  } catch (exception) {
    throw exception;
  }
};
const getDuplicatePincodes = async (pincodes) => {
  try {
    const query = `SELECT pincode FROM hub_pincode_mapping WHERE pincode IN (?);`;
    const [rows] = await readDB.query(query, [pincodes]);
    return rows;
  } catch (exception) {
    console.log(exception);
    throw exception;
  }
};

const saveServiceablePincodes = async (data) => {
  try {
    const query = `INSERT INTO hub_pincode_mapping (hub_id, city, pincode) VALUES ?`;
    // ON DUPLICATE KEY UPDATE pincode = pincode;`
    const [rows] = await writeDB.query(query, [data]);
    return rows;
  } catch (exception) {
    throw exception;
  }
};

const getHubsServiceablePincodes = async (hub_id) => {
  try {
    const query = `SELECT pincode FROM hub_pincode_mapping WHERE hub_id = ?;`;
    const [rows] = await readDB.query(query, [hub_id]);
    return rows;
  } catch (exception) {
    throw exception;
  }
};

const getPincodeLocation = async (user_id) => {
  try {
    const query = `SELECT DISTINCT(PL.pincode) FROM pickup_request PR
                        INNER JOIN pickup_location PL ON PR.pickup_location_id = PL.id 
                        INNER JOIN user_hub UH ON PR.hub_id = UH.hub_id
                        WHERE UH.user_id = ?;`;
    const [rows] = await readDB.query(query, [user_id]);
    return rows;
  } catch (exception) {
    throw exception;
  }
};

const deletePincodesByHubId = async (hub_id) => {
  try {
    let result = await writeDB.query(
      `DELETE FROM hub_pincode_mapping WHERE  hub_id = ?`,
      [hub_id],
    );
    return true;
  } catch (exception) {
    console.error(exception);
    throw new Error(exception.message || exception);
  }
};

const savePincodes = async (field_names, insert_arr) => {
  try {
    const query = `INSERT INTO hub_pincode_mapping (??)
                        VALUES ?`;

    const [rows] = await writeDB.query(query, [field_names, insert_arr]);
    return rows;
  } catch (exception) {
    console.error(exception);
    throw exception;
  }
};

const updateBagSealCount = async (hub_id, diff_bag_count, diff_seal_count) => {
  try {
    const query = `UPDATE hub_details SET available_bag_count =  available_bag_count + ${diff_bag_count}, available_seal_count = available_seal_count + ${diff_seal_count}
                       WHERE id = ?;`;
    let [rows] = await writeDB.query(query, [hub_id]);
    return true;
  } catch (exception) {
    throw exception;
  }
};

const getAllHubsList = async (allHubs) => {
  try {
    let query = `SELECT * FROM hub_details WHERE 1`;

    if (allHubs) {
      query += ` AND status IN (1,2,3)`;
    } else {
      query += ` AND status IN (1,2,3) AND type IN (0,1,2)`;
    }

    let [rows] = await readDB.query(query);

    return rows;
  } catch (exception) {
    throw exception;
  }
};

const getBagInventoryData = async (offset, limit, filters, user_id) => {
  try {
    let { code, city, startDate, endDate, hub_id } = filters;
    let query = `SELECT HD.id, HD.name, HD.code, HD.city, BSI.stock_added_date, HD.available_seal_count, HD.available_bag_count 
                        FROM bag_seal_inventory BSI 
                        INNER JOIN hub_details HD ON HD.id = BSI.hub_id
                        LEFT JOIN user_hub UH ON HD.id = UH.hub_id
                        WHERE 1  `;

    if (user_id) query += ` AND UH.user_id = ?`;

    if (hub_id) query += ` AND HD.id IN (?)`;

    if (startDate && endDate)
      query += ` AND BSI.stock_added_date >= '${dayjs(startDate).format(
        'YYYY-MM-DD 00:00:00',
      )}' AND BSI.stock_added_date <= '${dayjs(endDate).format(
        'YYYY-MM-DD 23:59:59',
      )}'`;

    if (code) query += ` AND HD.code = ${code}`;

    if (city) query += ` AND HD.city = ${city}`;

    query += ` GROUP BY HD.id ORDER BY BSI.id DESC LIMIT ${offset},${limit}`;

    let [rows] = await readDB.query(query, [user_id, hub_id]);

    return rows;
  } catch (exception) {
    throw exception;
  }
};

const getBagInventoryDataForExport = async (filters, user_id) => {
  try {
    let { startDate, endDate, hub_id } = filters;

    let query = `SELECT HD.name, HD.code, HD.city, BSI.stock_added_date, HD.available_seal_count, HD.available_bag_count 
                        FROM bag_seal_inventory BSI 
                        INNER JOIN hub_details HD ON HD.id = BSI.hub_id
                        LEFT JOIN user_hub UH ON HD.id = UH.hub_id
                        WHERE 1 `;

    if (user_id) query += ` AND UH.user_id = '${user_id}'`;

    if (hub_id) query += ` AND HD.id IN ('${hub_id}')`;

    if (startDate && endDate)
      query += ` AND BSI.stock_added_date >= '${dayjs(startDate).format(
        'YYYY-MM-DD 00:00:00',
      )}' AND BSI.stock_added_date <= '${dayjs(endDate).format(
        'YYYY-MM-DD 23:59:59',
      )}'`;

    query += ` GROUP BY HD.id ORDER BY BSI.id DESC `;

    return query;
  } catch (exception) {
    throw exception;
  }
};

const getActiveHub = async (status) => {
  try {
    const query = ` SELECT COUNT(id) active_hub FROM hub_details WHERE id NOT IN (21,22) AND type IN ( 0,2,3)  AND status IN (?) `;

    let [rows] = await readDB.query(query, [status]);

    if (!rows.length) return [{ active_hub: 0 }];

    return rows;
  } catch (exception) {
    throw exception;
  }
};

const getHubWiseRiderList = async (hub_ids) => {
  try {
    const query = `SELECT U.id,U.name
                FROM user_hub UH 
                JOIN users U ON U.id = UH.user_id
                WHERE U.role_id = 2 AND UH.hub_id IN (?) AND U.status = 1;`;

    const [rows] = await readDB.query(query, [hub_ids]);

    return rows;
  } catch (exception) {
    console.error(exception);
    throw exception;
  }
};

const getUserListRiderOrOther = async (rider) => {
  try {
    //role id 2 for rider
    let query = `SELECT id, name FROM users WHERE `;
    query += rider ? ` role_id = 2 ;` : ' role_id != 2;';
    const [rows] = await readDB.query(query);
    return rows;
  } catch (exception) {
    console.error(exception);
    throw exception;
  }
};

const getAllHubList = async () => {
  try {
    let query = `SELECT id, name, code FROM hub_details `;
    const [rows] = await readDB.query(query);
    return rows;
  } catch (exception) {
    console.error(exception);
    throw exception;
  }
};


const getHubListForSetting = async (hubIdList) => {
  try {
    let query = `SELECT id, name, code, lat, lng, address, pincode FROM hub_details `;
    query += hubIdList.includes(0) ? ';' : " WHERE id IN (?) ;"
    const [rows] = await readDB.query(query, [hubIdList]);
    return rows;
  } catch (exception) {
    console.error(exception);
    throw exception;
  }
};

const zoneEnabledHubList = async () => {
  try {
    let query = `SELECT hd.id, hd.name, hd.code FROM hub_details hd INNER JOIN hub_zone_mapping hzm ON hzm.hub_id = hd.id WHERE hzm.status = 1 GROUP BY hd.id;`;
    const [rows] = await readDB.query(query);
    return rows;
  } catch (exception) {
    console.error(exception);
    throw exception;
  }
};
module.exports = {
  saveHub,
  getAllHubUsers,
  getAllHubs,
  editHubDetails,
  getHubByCode,
  getHubDetailsById,
  getCities,
  saveServiceablePincodes,
  getDuplicatePincodes,
  getHubsServiceablePincodes,
  deletePincodesByHubId,
  getCityWiseHubs,
  getPincodeLocation,
  getHubByGatewayCode,
  updateBagSealCount,
  getAllHubsList,
  getBagInventoryData,
  getBagInventoryDataForExport,
  getActiveHub,
  getHubWiseRiderList,
  savePincodes,
  getUserListRiderOrOther,
  getAllHubList,
  getHubListForSetting,
  zoneEnabledHubList,
};
