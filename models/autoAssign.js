'use strict';

/* Table Structure for 'auto_assign_setting' */
/* 
Columns:
- 'id': The primary key of the table, auto-incremented for each new row.
- 'setting_name': The name of the setting (e.g., 'auto_assign_enabled', 'default_hub', etc.).
- 'status': The status of the setting, represented as a tinyint with possible values 0 (inactive) and 1 (active).
- 'hub': A JSON field storing hub information.
- 'value': A JSON field storing setting values in a JSON format.
- 'created': A timestamp representing the creation time of the row, set to the current timestamp when a new row is inserted.
- 'modified': A timestamp representing the last modification time of the row, automatically updated to the current timestamp whenever the row is updated.

Indexes:
- PRIMARY KEY on 'id': Uniquely identifies each row in the table.
- UNIQUE KEY on 'setting_name': Ensures that the 'setting_name' column contains unique values.
*/

const updateAutoAssignDetails = async (updateObj) => {
  try {
    const query = `INSERT INTO auto_assign_setting SET ? ON DUPLICATE KEY UPDATE ?`;
    await writeDB.query(query, [updateObj, updateObj]);
  } catch (error) {
    throw error;
  }
};

const getAutoAssignDetails = async () => {
  try {
    const query = `SELECT setting_name, hub, status, value FROM auto_assign_setting`;
    const [rows] = await readDB.query(query);
    return rows;
  } catch (error) {
    throw error;
  }
};

const getAutoAssignDetailsByName = async (settingName) => {
  try {
    const query = `SELECT setting_name, hub, status, value FROM auto_assign_setting WHERE setting_name = ?;`;
    const [rows] = await readDB.query(query, [settingName]);
    return rows;
  } catch (error) {
    throw error;
  }
};

const getZoneDetailsByHubId = async (hubId) => {
  try {
    const query = `SELECT id, zone_name, pincodes FROM hub_zone_mapping WHERE status = 1 AND hub_id = ?;`;
    const [rows] = await readDB.query(query, [hubId]);
    return rows;
  } catch (error) {
    throw error;
  }
};

const getRiderByZone = async (zoneId) => {
  try {
    const query = `SELECT id FROM users WHERE status = 1 AND role_id = 2 AND zone_id = ?;`;
    const [rows] = await readDB.query(query, [zoneId]);
    return rows;
  } catch (error) {
    throw error;
  }
};

const getRiderOutsideZone = async (hubId, zoneId) => {
  try {
    const query = `SELECT u.id FROM users u 
                    INNER JOIN user_hub uh ON uh.user_id = u.id
                     WHERE u.status = 1 AND u.role_id = 2 AND (u.zone_id NOT IN (?) OR u.zone_id IS NULL) AND uh.hub_id = ? ;`;
    const [rows] = await readDB.query(query, [zoneId, hubId]);
    return rows;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getZoneDetailsByHubId,
  getRiderByZone,
  updateAutoAssignDetails,
  getAutoAssignDetails,
  getAutoAssignDetailsByName,
  getRiderOutsideZone
};
