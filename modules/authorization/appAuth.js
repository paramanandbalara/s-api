"use strict";

let crypto = require('crypto');
const jwt = require('jsonwebtoken');
const assert = require('assert')
const { getApplicationKeys } = require('../../models/application_keys')
const { generateHashToken } = require('../generateHash')

/**
 * validate a token given the the parameters.
 * @class  AuthMiddleware
 * @param   {Integer}   appID       The App's ID
 * @param   {String}    token       Authorization token sent by the caller
 * @param   {Date}      timestamp   The UNIX timestamp
 */
const validateToken = async (appID, tokenProvided, timestamp, ENTITY_NAME) => {

    const KEY_DETAILS = await getApplicationKeys(ENTITY_NAME);
    if (KEY_DETAILS.length == 0)
        throw Error('Details not found for Entity')

    const { public_key, secret_key } = KEY_DETAILS[0]

    const generatedToken = await generateHashToken(`key:${public_key}id:${appID}:timestamp:${timestamp}`, secret_key)

    if (generatedToken === tokenProvided)
        return true
    else
        throw new Error("Then token provided did not match with the one we generated")
}

/**
 * Authentication Middleware. Usage: app.use(require('./path/to/authMiddleware'))
 * @class AuthMiddleware
 * @param  {Request}    req  The Express Request object
 * @param  {Response}   res  The Express Response object
 * @param  {Function}   next The Express success callback function
 * @return {Boolean}    True if the authentication succeeded, false otherwise.
 */


const isAppAuthorized = async (req, res, next) => {

    const host = req.headers.host

    if (process.env.NODE_ENV != "production")
        console.log(__line, host);

    const appID = req.headers["x-appid"] || req.query.appid;
    const token = req.headers["authorization"] || req.query.authorization;
    const timestamp = req.headers["x-timestamp"] || req.query.timestamp;
    const entity_name = req.headers["x-entity_name"] || req.query.entity_name;

    try {

        assert(appID, "an appID was not provided")
        assert(token, "a token was not provided")
        assert(timestamp, "a timestamp was not provided")
        assert(entity_name, "an entity name was not provided")

        const tsDate = new Date(timestamp.toString().length == 10 ? timestamp * 1000 : timestamp);

        if ((new Date() - tsDate) > 60000) { // 1min
            const error = new Error("Stale Request");
            error.code = 401;
            return next(error);
        }

        const result = await validateToken(appID, token, timestamp, entity_name)
        if (result)
            return next()
        else
            throw new Error("Please check the params in your request");
    }
    catch (err) {
        console.error(__line, err)
        next(err.message);
    }
}

const generateAuth = async (appID, key, secret, timestamp) => {
    try {

        let sign = `key:${key}id:${appID}:timestamp:${timestamp}`
        let hash = crypto.createHmac(`sha256`, secret)
            .update(sign)
            .digest(`base64`).toString()

        let encoded = encodeURIComponent(hash)
        return Promise.resolve(encoded)
    } catch (err) {
        return Promise.reject(err)
    }
}



module.exports = { isAppAuthorized, generateAuth };
