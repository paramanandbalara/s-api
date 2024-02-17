"use strict";

const path = require('path');
const logger = require('morgan');
const express = require('express');
const cors = require('cors')


Object.defineProperty(global, '__line', {
    get: function () {
        return ((new Error()).stack.split("\n")[2].trim().replace(/^(at\s?)(.*)/gim, "$2 >").replace(__dirname, ""))
    }
})

module.exports = (app) => {

    const initDB = require('./db');
    initDB(process.env.NODE_ENV)
    const corsConfig = {
        origin: true,
        credentials: true,
        exposedHeaders: ['Content-Length', 'access_token', 'otp_token', 'secret_key']
    };


    app.use(cors(corsConfig));
    app.options('*', cors(corsConfig));

    const bodyParser = require('body-parser');

    app.use(logger('dev'));

    app.use(bodyParser.json({ limit: '10mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

    app.use(express.static(path.join(__dirname, 'public')));


}