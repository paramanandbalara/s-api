"use strict";

const saveUser = async (userDetails) => {

    try {
        const [rows] = await writeDB.query(`INSERT INTO users SET ?`, [userDetails])
        return rows?.insertId
    } catch (exception) {
        console.error(exception.message)
        throw new Error(exception.message)
    }
}

const getUserByPhone = async (contact_number) => {
    try {
        //TODO select column as an arguments.....
        const [rows] = await readDB.query(`SELECT * from users WHERE contact_number = ?`, [contact_number]);
        return rows;

    } catch (exception) {
        console.error(exception.message)
        throw new Error(exception.message)
    }
}


const checkOldPassword = async (user_id) => {
    try {

        const query = 'SELECT password FROM users WHERE id = ?;'

        const [rows] = await readDB.query(query, [user_id]);

        return rows[0]

    } catch (exception) {
        console.error(exception.message)
        throw new Error(exception.message)
    }
}


const updateUser = async (user_id, update_obj) => {
    try {

        const query = `UPDATE users SET ? WHERE id = ? ;`
        const [result] = await writeDB.query(query, [update_obj, user_id])

        return true;

    } catch (exception) {
        console.error(exception.message)
        throw new Error(exception.message)
    }
}

const getUserDetailsById = async (user_id) => {
    try {
        const query = `SELECT users.id, users.name, users.email, users.contact_number, 
                        users.address, users.vehicle_number, roles.role, users.role_id,
                        users.status, users.app_access, users.secure_package,
                        users.fav_setting,users.vehicle_type_id, users.zone_id, users.two_fa_method
                        FROM users 
                        JOIN roles ON roles.id = users.role_id
                        WHERE users.id = ?;`;

        const [rows] = await readDB.query(query, [user_id])
        return rows[0];
    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getUser = async (user_id) => {
    try {
        const [rows] = await readDB.query(`SELECT * FROM users WHERE id = ?;`, [user_id])
        return rows[0];
    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getUsersByRoleId = async (role_id) => {
    try {
        const [rows] = await readDB.query(`SELECT * FROM users WHERE role_id = ?;`, [role_id])
        return rows
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const getHubsByUserId = async (user_id, is_gateway = false) => {
    try {
        let query = `SELECT user_hub.hub_id, hub_details.* FROM user_hub INNER JOIN hub_details ON user_hub.hub_id = hub_details.id  WHERE user_id = ? and  hub_details.status IN (1,2,3) `

        if (is_gateway) {
            query += ` AND hub_details.type = 1 ;`
        }

        const [rows] = await readDB.query(query, [user_id])
        return rows
    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

const getUserFavourites = async (userId) => {
    try {
        const query = `SELECT fav_setting FROM users WHERE id = ?;`;
        const [rows] = await readDB.query(query, [userId])
        return rows
    } catch (exception) {
        throw exception;
    }
}

const updateUsersFavReports = async (userId, updateData) => {
    try {
        const query = `UPDATE users
                                SET fav_setting = JSON_SET(fav_setting, '$.reports_fav', ?)
                                WHERE id = ?;`;
        await writeDB.query(query, [updateData, userId]);
    } catch (exception) {
        throw exception;
    }
}

const updateLocationInfoSetting = async (userId, locationInfo) => {
    try {
        const query = `UPDATE users
                                SET fav_setting = JSON_SET(fav_setting, '$.location_info', ?)
                                WHERE id = ?;`;
        const [rows] = await writeDB.query(query, [locationInfo, userId]);
        return rows
    } catch (error) {
        throw error;
    }
}



module.exports = {
    saveUser,
    getUserByPhone,
    checkOldPassword,
    getUserDetailsById,
    updateUser,
    getUser,
    getUsersByRoleId,
    getHubsByUserId,
    getUserFavourites,
    updateUsersFavReports,
    updateLocationInfoSetting
}
