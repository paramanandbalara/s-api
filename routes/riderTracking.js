'use strict';

const express = require('express');
const router = express.Router();
const RiderTracking = require('../controller/riderTracking');

router.get('/rider/eventtracking', async (req, res) => {
    try {
        const { startDate, endDate, rider_id, page, offset, hub_id } = req.query;
        const userId = req.header('x-userid')
        const riderTrackingController = new RiderTracking();
        const result = await riderTrackingController.getRiderTracking({ startDate, endDate, userId, rider_id, page, offset, hub_id });
        res.send({ success: true, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, message: 'Data retrieved' });
    } catch (error) {
        console.error(__line, error);
        res.send({ success: false, message: error.message || error });
    }
});

module.exports = router;
