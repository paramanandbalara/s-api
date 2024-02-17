
"use strict";

const express = require('express');
const router = express.Router()
const BAGGING_CONTROLLER = require('../controller/bagging')

router.post('/outscan', async (req, res) => {
    try {

        const body = Object.assign({}, req.body);

        let user_id = req.header('x-userid')

        const { bags_list, transporter_id, transporter_awbno, airway_bill_img, airway_bill_type, hub_id } = body;

        const BAGGING = new BAGGING_CONTROLLER();

        const result = await BAGGING.outScanBags({ bags_list, transporter_id, transporter_awbno, airway_bill_img, airway_bill_type, user_id, hub_id });

        res.send({ success: true, message: `Departed from origin hub` });

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/outscan/list', async (req, res) => {
    try {
        let user_id = req.header('x-userid')

        const { page, offset, hub_id } = req.query;


        const BAGGING = new BAGGING_CONTROLLER();

        const result = await BAGGING.outScanBagsList(user_id, page, offset, hub_id);

        res.send({ success: true, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, message: 'Data retrieved' });

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})

router.post('/outscan/bag/edit', async (req, res) => {
    try {
        const BAGGING = new BAGGING_CONTROLLER();

        const { transporter_awbno, airway_bill_img, airway_bill_type, bags_list, transporter_id } = req.body;

        const result = await BAGGING.updateBagDetailsWithAirwayBill({ airwayBillNumber: transporter_awbno, transporterId: transporter_id, airwayBillImg: airway_bill_img, airwayBillType: airway_bill_type, bagCodes: bags_list });

        res.send({ success: true, message: `Departed from origin hub` });
    } catch (error) {
        console.error(error);
        res.send({ success: false, message: error.message || 'Internal server error' });
    }
});


module.exports = router;
