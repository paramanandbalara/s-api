"use strict";

const express = require('express');
const router = express.Router()
const FailureReasonController = require('../controller/failureReason')

router.get('/failure/reason', async (req, res, next) => {
    try {

        const { type } = req.query;

        const failureReasonController = new FailureReasonController();

        const result = await failureReasonController.getFailureReason(type);

        res.send({ success: true, data: result.data, message: 'Data Retrieved Successfully' });

    }
    catch (exception) {
        console.error(__line, exception);
        res.send({ success: false, message: exception.message || exception });
    }
})

router.post('/failure/reason', async (req, res, next) => {
    try {
        let { failure_reason_id, pickup_request_no, route_request_assigned_id } = req.body;

        const body = { failure_reason_id, pickup_request_no, route_request_assigned_id };

        const failureReasonController = new FailureReasonController();

        const result = await failureReasonController.updatePickupRequest(body);

        res.send({ success: true, message: 'Rescheduled successfully' });

    }
    catch (exception) {
        console.error(__line, exception);
        res.send({ success: false, message: exception.message || exception });
    }
})

router.post('/failure/reason/deliver', async (req, res, next) => {
    try {
        let { failure_reason_id, delivery_request_no, route_request_assigned_id } = req.body;

        const body = { failure_reason_id, delivery_request_no, route_request_assigned_id };

        const failureReasonController = new FailureReasonController();

        const result = await failureReasonController.updateDeliverRequest(body);

        res.send({ success: true, message: 'Rescheduled successfully' });

    }
    catch (exception) {
        console.error(__line, exception);
        res.send({ success: false, message: exception.message || exception });
    }
})


module.exports = router;