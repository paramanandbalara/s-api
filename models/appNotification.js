'use strict';

const getAppNotificationByName = async (notificationName) => {
	try {
		const [rows] = await readDB.query(
			'SELECT id, event_name, type, status, audience, receiver, unsubscribe, email_id, contact_no, whatsapp_contact FROM notification WHERE event_name IN (?)',
			[notificationName]
		);
		return rows;
	} catch (error) {
		throw error;
	}
};

const updateAppNotificationByName = async (notificationName, updateObj) => {
	try {
		let query = `UPDATE notification SET ? WHERE event_name = ?`;
		await writeDB.query(query, [updateObj, notificationName]);
	} catch (error) {
		throw error;
	}
};

module.exports = {
	getAppNotificationByName,
	updateAppNotificationByName,
};
