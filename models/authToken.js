"use strict";


const insertToken = async (token_object) => {
    try {

        const [rows] = await writeDB.query(`INSERT INTO auth_token SET ?`, [token_object])

        if (rows?.insertId)
            return rows.insertId;

        throw new Error("Error while inserting token")
    } catch (exception) {
        console.error(exception.message)
        throw new Error(exception.message || exception)
    }
}

const deleteToken = async (rid) => {

    try {
        let result = await writeDB.query(`DELETE FROM auth_token WHERE  id = ?`, [rid])

        return true;

    } catch (exception) {
        console.error(exception.message)
        throw new Error(exception.message || exception)
    }
}

const getRefreshToken = async (rid) => {
    try {
        const [rows] = await readDB.query(
            `SELECT user_id, refresh_token ,id , session_status FROM auth_token WHERE id = ?;`, [rid]);
        return rows;
    } catch (exception) {
        console.error(exception.message)
        throw new Error(exception.message || exception)
    }
}


const saveAccessToken = async (rid, access_token) => {
    try {

        const query = `UPDATE auth_token SET  access_token = ? WHERE id = ?`;

        const [rows] = await writeDB.query(query, [access_token, rid])

        return true;
    } catch (exception) {
        console.error(exception.message)
        throw new Error(exception.message || exception)
    }
}

const updateTokenStatus = async (user_ids, status) => {
    try {
        // session_status - 0 - Default, 1 - Refresh, 2- logout
        let [rows] = await writeDB.query(`UPDATE auth_token SET session_status = ? WHERE user_id IN (?) AND session_status = 0;`, [status, user_ids])
        return rows;
    } catch (exception) {
        console.error(exception);
        throw exception;
    }
}

const forceLogoutWebUser = async (source) => {
    try {
        /* 
        source 1 means web login 
        source 2 means mobile app login
        */

        const query = 'UPDATE auth_token SET session_status = 2 WHERE  source = ?;';
        await writeDB.query(query, [source]);
    } catch (error) {
        throw error;
    }
}

const updateAuthToken = async (rid, updateObj) => {
    try {
        const query = `UPDATE auth_token SET ? WHERE id = ?;`;
        await writeDB.query(query, [updateObj, rid]);
    } catch (error) {
        throw error;
    }
}

const checkUserAlreadyLoggedIn = async (userId) => {
    try {
        //0 - Default, 1 - Refresh, 2- logout
        const query = `SELECT id FROM auth_token WHERE user_id = ? AND session_status = 0;`;
        const [rows] = await readDB.query(query, [userId]);
        return rows;
    } catch (exception) {
        console.error(exception);
        throw error;
    }
}

const deleteTokenByUserId = async (user_id) => {

    try {
        const [rows] = await writeDB.query(`DELETE FROM auth_token WHERE  user_id = ?  AND session_status = 0;`, [user_id])
        return rows;
    } catch (exception) {
        console.error(exception);
        throw exception;
    }
}

module.exports = { insertToken, deleteToken, getRefreshToken, saveAccessToken, updateTokenStatus, forceLogoutWebUser, updateAuthToken, checkUserAlreadyLoggedIn, deleteTokenByUserId };