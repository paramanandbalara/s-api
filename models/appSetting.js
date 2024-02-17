'use strict';

/**
 * Table schema :
 *
 * TABLE `app_setting` (
 *   `id` int(11) NOT NULL AUTO_INCREMENT,
 *   `setting_name` varchar(40) NOT NULL,
 *   `setting_id` int(11) NOT NULL,
 *   `app_type` tinyint(4) DEFAULT '1' COMMENT '1: web, 2: mobile apk',
 *   `status` tinyint(4) DEFAULT '0' COMMENT '0: inactive, 1: active',
 *   `user` json DEFAULT NULL,
 *   `hub` json DEFAULT NULL,
 *   `value` json DEFAULT NULL,
 *   `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *   `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 *   PRIMARY KEY (`id`)
 * )
 */

/*
 * Setting IDs and Names:
 * 1. mobile_number_masking
 * 2. rider_capacity
 * 3. login_distance_restriction
 * 4. login_via_otp
 * 5. pickup_via_otp
 * 6. pickup_via_signature
 * 7. require_location_for_login
 * 8. distance_restriction
 */

/**
 * Retrieves the app setting by the provided setting ID.

 * @returns {Promise} A Promise that resolves with the retrieved app setting.
 */

const getSettingDataByName = async (settingName) => {
  try {
    const [rows] = await readDB.query(
      'SELECT hub, user, status, value FROM app_setting WHERE setting_name IN (?);',
      [settingName],
    );
    return rows;
  } catch (error) {
    throw error;
  }
};

const updateAppSettingbySettingName = async (settingName, updateObj) => {
  try {

    const {
      userList,
      hubsList,
      status,
      geoFence
    } = updateObj;

    const queryParams = [];
    const qyeryString = [];
    let query = `UPDATE app_setting SET`;

    if (userList) {
      qyeryString.push(` user = JSON_SET(user, '$.user_id', JSON_ARRAY(?))`);
      queryParams.push(userList);
    }

    if (hubsList) {
      qyeryString.push(` hub = JSON_SET(hub, '$.hub_id', JSON_ARRAY(?))`);
      queryParams.push(hubsList);
    }

    if (geoFence) {
      qyeryString.push(` value = JSON_SET(value, '$.geo_fence', ?)`);
      queryParams.push(geoFence);
    }

    if ([0, 1].includes(Number(status))) {
      qyeryString.push(` status = ?`);
      queryParams.push(status);
    }

    if(!(queryParams.length && qyeryString.length)) {
      throw new Error('Bad request')
    }

    query += qyeryString.join(' , ');
    query += ` WHERE setting_name = ?`;
    queryParams.push(settingName);
    const [rows] = await writeDB.query(query, queryParams);
    return rows;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  updateAppSettingbySettingName,
  getSettingDataByName,
};
