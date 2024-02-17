"use strict"

const insertErrorLog = async (awb, error) => {
    try {
        let data = { error: error }
        if (awb) data.awb = awb
        return await writeDB.query(`INSERT INTO error_logs SET ?`, [data])

    } catch (error) {
        console.log(__line, error)
        throw Error(error)
    }
}

module.exports = { insertErrorLog }