"use strict";

const { Router } = require('express');
const router = Router();
const IvrController = require('../controller/ivr');

router.post('/ivr/voice-call', async (req, res, next) => {
    try {
        const { route_request_assigned_id: routeReqAssignedId } = req.body;

        if (!routeReqAssignedId) throw new Error("No pickup request found");

        const ivrController = new IvrController();

        await ivrController.ivrCall(routeReqAssignedId);

        res.send({ success: true, message: 'Calling' });
    }
    catch (exception) {
        console.error(__line, exception);
        res.send({ success: false, message: exception.message || exception });
    }
})

module.exports = router;