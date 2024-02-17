"use strict";

const randomstring = require("randomstring");
const crypto = require('crypto');
const { random } = require("lodash");

/**
 * Returns a secure, random, base64 encoded string.
 * @return {String} randomly generated secure string of 12 chars
 */

function genRandomString () {
    return crypto.randomBytes(8).toString('base64')
}

function getPassword() {
    let password = randomstring.generate({
        length: 12,
        charset: 'alphanumeric'
    })
    // return password;

    return "password"
};

function getUserId() {
    let user_id = randomstring.generate({
        length: 8,
        charset: 'numeric'
    });
    return user_id
}

module.exports = {
    getPassword,
    getUserId,
    genRandomString
}
