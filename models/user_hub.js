"use strict"

const getUserHubMappingDetails = async (user_id) => {
    try {
        const SQL = `SELECT * FROM user_hub WHERE user_id = ?`
        const [rows] = await readDB.query(SQL, [user_id])
        return rows

    } catch (error) {
        throw Error(error)
    }
}

const getHubDetailsBasedOnUser = async (user_id) => {
    try {
        const SQL = `SELECT * FROM user_hub uh 
        JOIN hub_details hd ON hd.id = uh.hub_id
        WHERE uh.user_id = ?`
        const [rows] = await readDB.query(SQL, [user_id])
        return rows

    } catch (error) {
        throw Error(error)
    }
}
const saveUserHubMapping = async (user_id, hubIds) => {
    try {
        const values = hubIds.map(hubId => [user_id, hubId])
        const SQL = `INSERT INTO user_hub (user_id,hub_id) VALUES ?`
        const [rows] = await writeDB.query(SQL, [values])
        return rows

    } catch (error) {
        throw Error(error)
    }
}
const deleteUserHubMapping = async (user_id) => {
    try {

        const SQL = `DELETE FROM user_hub WHERE user_id = ?`
        const [rows] = await writeDB.query(SQL, [user_id])
        return rows

    } catch (error) {
        throw Error(error)
    }
}


module.exports = {
    getUserHubMappingDetails,
    getHubDetailsBasedOnUser,
    saveUserHubMapping,
    deleteUserHubMapping
}