"use strict";

const express = require('express');
const router = express.Router()
const TRANSPORTER_CONTROLLER = require('../controller/transporter');
const BAGGING_CONTROLLER = require('../controller/bagging');

router.get('/transporter/all/list', async (req, res) => {
    try {

        const { page, offset, hub_code, hub_city } = req.query;

        const filters = { page, offset, hub_code, hub_city };

        const TRANSPORTER = new TRANSPORTER_CONTROLLER();

        let result = await TRANSPORTER.transporterList(filters);

        res.send({ success: true, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, message: 'Data retrieved' });

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})

router.post('/transporter/add', async (req, res, next) => {
    try {

        const { hub_id, name, mode } = req.body;

        const TRANSPORTER = new TRANSPORTER_CONTROLLER();

        const result = await TRANSPORTER.addTransporter(hub_id, name, mode);

        res.send({ success: true, message: 'Transporter added successfully' });

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/transporter/get', async (req, res) => {
    try {
        const { id } = req.query;

        const TRANSPORTER = new TRANSPORTER_CONTROLLER();

        const result = await TRANSPORTER.transporterEditFetch(id);

        res.send({ success: true, data: result, message: 'Data retrieved' });

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})

router.post('/transporter/edit', async (req, res, next) => {
    try {

        const { name, id, mode } = req.body;

        const TRANSPORTER = new TRANSPORTER_CONTROLLER();

        const result = await TRANSPORTER.editTransporter(id, name, mode);

        res.send({ success: true, data: result, message: 'Transporter updated successfully' });

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/transporter/list', async (req, res) => {
    try {

        let user_id = req.header('x-userid')

        const { hub_id } = req.query;

        const BAGGING = new BAGGING_CONTROLLER();

        const result = await BAGGING.transporterList(user_id, hub_id);

        res.send({ success: true, data: result, message: 'Data retrieved' });

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})



module.exports = router;