"use strict";

const express = require('express');
const router = express.Router()
const INSCAN_CONTROLLER = require('../controller/inscan')


router.post('/inscan/scan', async (req, res) => {
    try {
        const body = Object.assign({}, req.body)
        const user_id = req.header('x-userid');
        const INSCAN = new INSCAN_CONTROLLER();
        const result = await INSCAN.inScan(body);

        res.send(result);
    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message });
    }
})

router.get('/inscan/scan/list', async (req, res) => {
    try {
        const user_id = req.header('x-userid');
        const { page, offset, hub_id } = req.query;

        if (!hub_id) throw new Error("Please select hub")

        const INSCAN = new INSCAN_CONTROLLER();
        const result = await INSCAN.getInscanOrderList(user_id, page, offset, hub_id)
        
        res.send({ success: true, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, message: 'Data retrieved' });


    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message });
    }
})

module.exports = router;
