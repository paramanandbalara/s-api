"use strict";

const express = require('express');
const router = express.Router();
const USER_CONTROLLER = require('../../controller/user/user');

const { validatePassword, validateForceLogoutUserId, validPassword } = require('../../validation/users');
const validateRequest = require('../../middleware/reqValidator')


router.post('/users/create', validateRequest(validPassword), async (req, res, next) => {
    try {

        const USER = new USER_CONTROLLER();
        let body = Object.assign({}, req.body);
        //body = await validateUser().validate(body);
        
        if(body.hub_id.length == 0)
            throw Error('No value provided for hub id')

        let userid = req.header('x-userid')

        // const body = await validateUser().validate(req.body)
        let unused = await USER.createUser(body,userid)

        return res.send({ success: true, message: `User created successfully` });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message });

    }
})

router.post('/users/changepassword', async (req, res, next) => {
    try {

        const user_id = req.header('x-userid')

        if (!user_id) {
            return res.status(401).send({ success: false, message: "User Id Not Found" })

        }

        await validatePassword().validate(req.body)

        const body = Object.assign({}, req.body);

        const USER = new USER_CONTROLLER();

        const result = await USER.changePass(user_id, body)

        res.send({ success: true, message: result });

    } catch (exception) {

        console.error(exception.message || exception)

        return res.send({ success: false, message: exception.message || exception });

    }
})

router.post('/applogout', async (req, res, next) => {

    try {

        let access_token = req.header('access_token');

        const body = Object.assign({}, req.body);

        const USER = new USER_CONTROLLER();

        const result = await USER.appLogout(access_token);

        return res.send({ success: true, message: "Success" })
        
    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message });
    }
})

router.get('/users/:id', async (req, res, next) => {

    try {

        const user_id = req.header('x-userid')

        const { id } = req.params

        const USER = new USER_CONTROLLER();

        const result = await USER.getUserDetails(id)

        res.send({ success: true, message: `User Details Retrieved'`, data: result });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message });
    }
})

router.post('/users/edit/:id', async (req, res, next) => {
    try {

        const { id } = req.params;

        if (!id) {
            throw new Error("id required in params")
        }

        const body = Object.assign({}, req.body);

        let userid = req.header('x-userid')

        const USER = new USER_CONTROLLER();
        
        const result = await USER.editUser(id, body);

        res.send({ success: true, message: `User updated successfully` });

    }
    catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });
    }
});


router.get('/checksession', async (req, res, next) => {
    try {

        let access_token = req.header('access_token');

        const USER = new USER_CONTROLLER();

        const result = await USER.getToken(access_token);

        res.send({ success: true, data: result });

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})

router.post('/users/force-logout', validateRequest(validateForceLogoutUserId) , async (req, res, next) => {
    try{
        const { user_id, app_access } = req.body;
        const USER = new USER_CONTROLLER();
        await USER.forceLogout(user_id, app_access);
        res.send({ success: true, message: `User logged-out successfully` });
    }
    catch(exception){
        console.error(exception);
        res.send({ success: false, message: exception.message || exception });
    }
})

module.exports = router;