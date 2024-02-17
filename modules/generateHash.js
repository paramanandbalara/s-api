"use strict"
const crypto = require('crypto')
const generateHashToken = async(dataString, secretKey) => {

    return crypto.createHmac('sha256', secretKey)
        .update(dataString, 'utf8')
        .digest("base64").toString()
}
module.exports = { generateHashToken }