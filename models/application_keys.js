"use strict"

const getApplicationKeys = async (entityName) => {
    try {

        const [rows] = await readDB.query(`SELECT id,public_key,secret_key FROM application_keys WHERE is_active = 1 AND entity_name = ?`, [entityName])

        return rows

    } catch (error) {
        console.log(error)
        throw Error(error)
    }
}
module.exports = {
    getApplicationKeys
}