'use strict';

const getZoneDataList = async (offset, limit) => {
	try {
		const sql = `SELECT HZM.id, HZM.hub_id, HZM.zone_name, HZM.pincodes, HZM.status, HD.code, HD.city
						FROM hub_details HD 
						INNER JOIN hub_zone_mapping HZM ON HD.id = HZM.hub_id 
						ORDER BY HZM.id DESC LIMIT ?,?;`;

		const [rows] = await readDB.query(sql, [offset, limit]);

		return rows;
	} catch (exception) {
		throw exception;
	}
};

const getZoneList = async (hubId) => {
	try {
		const sql = `SELECT id, zone_name FROM hub_zone_mapping WHERE hub_id IN (?)`;
		const [rows] = await readDB.query(sql, [hubId]);
		return rows;
	} catch (exception) {
		throw exception;
	}
};

const zoneDataByHubId = async (hubId) => {
	try {
		const sql = `SELECT id, hub_id, zone_name, pincodes, status FROM hub_zone_mapping WHERE hub_id = ?;`;

		const [rows] = await readDB.query(sql, [hubId]);
		return rows;
	} catch (exception) {
		throw exception;
	}
};

const createNewZone = async (insertZoneObj) => {
	try {
		const sql = `INSERT INTO hub_zone_mapping SET ?;`;

		const [rows] = await writeDB.query(sql, [insertZoneObj]);

		return rows;
	} catch (exception) {
		throw exception;
	}
};

const updateZoneDetailsById = async (zoneId, updateZoneObj) => {
	try {
		const sql = `UPDATE hub_zone_mapping SET ? WHERE id = ?;`;

		const [rows] = await writeDB.query(sql, [updateZoneObj, zoneId]);

		return rows;
	} catch (exception) {
		throw exception;
	}
};

module.exports = {
	createNewZone,
	updateZoneDetailsById,
	getZoneDataList,
	zoneDataByHubId,
	getZoneList
};
