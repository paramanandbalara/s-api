"use strict"

const express = require('express');
const router = express.Router();
const LOGIN_CONTROLLER = require('../../controller/user/login');
const { validatePassword, validatePhoneNo } = require('../../validation/users');
const validateRequest = require('../../middleware/reqValidator');



router.post('/users/login', async (req, res, next) => {
    try {

        const body = Object.assign({}, req.body);

        const LOGIN = new LOGIN_CONTROLLER();

        const result = await LOGIN.userLogin(req, res);

        res.send(result);

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})

router.post('/users/verifyotp', async (req, res, next) => {
    try {

        const body = Object.assign({}, req.body);

        const LOGIN = new LOGIN_CONTROLLER();

        const result = await LOGIN.verifyOtp(req, res);

        res.send(result);

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})

module.exports = router;