"use strict";
const { Router } = require('express');
const router = Router();
const AnalyticsController = require('../controller/analytics')

router.get('/analytics/slotwise-pickup-count', async (req, res, next) => {
    try {
        const analyticsController = new AnalyticsController();
        const result = await analyticsController.getSlotwisePickupCount();
        res.send({ success: true, data: result });
    } catch (error) {
        console.error(__line, error);
        res.send({ success: false, message: error.message || error });
    }
});


router.get('/analytics/average-time-taken-to-pickup', async (req, res, next) => {
    try {
        const { hub_id: hubId, pickup_state : pickupState = [2, 4] } = req.query;
        const analyticsController = new AnalyticsController();
        const result = await analyticsController.getAverageTimeTakenToPickup(hubId, pickupState);
        res.send({ success: true, data: result });
    } catch (error) {
        console.error(__line, error);
        res.send({ success: false, message: error.message || error });
    }
});

module.exports = router;