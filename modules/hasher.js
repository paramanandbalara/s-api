"use strict";

const crypto = require('crypto')
const iterations = 24000
const digest = 'sha256'

const randomString = require('./generaterandomstring')

/**
 * Encode : Use this method to generate a password that is to be stored inside the database. 
 * @class Hasher
 * @param  {String} secret Plain text accepted from the user.
 * @param  {String} salt   OPTIONAL: string that should be used as the salt for hashing. If not passed, a random string will be generated of 12 chars 
 * @return {String} Hashed string that is safe to securely store in the database
 */
const encode = (secret, salt) => {
    if (!salt)
        salt = randomString.genRandomString()
    let key = crypto.pbkdf2Sync(secret, salt, iterations, 32, digest)
    let decoded = new Buffer(key).toString('base64')
    return `pbkdf2_sha256\$${iterations}\$${salt}\$${decoded}`
}

/**
 * Verify: Use this method to verify a user entered password against what is stored in the DB. 
 * @class  Hasher
 * @param  {String} secret  Plain text accepted from the user.
 * @param  {String} encoded The encoded value from the database. This is generated at signup using the encode function.
 * @return {Boolean} True if it's the correct password, flase if it isn't. 
 */
const verify = (secret, encoded) => {
    
    let parts = encoded.split('$')
    let salt = parts[2]
    let userEncoded = encode(secret, salt)
    return userEncoded === encoded
}

module.exports = {
    encode,
    verify
}
