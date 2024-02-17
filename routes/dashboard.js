"use strict";

const express = require('express');
const router = express.Router()
const DashboardController = require('../controller/dashboard')

router.get('/dashboard/total/orders', async (req, res, next) => {
    try {

        const { startDate, endDate, hubid } = req.query;

        const user_id = req.header("x-userid");

        const filters = { startDate, endDate }

        const dashboardController = new DashboardController();

        const result = await dashboardController.getTotalOrders(filters, hubid);

        res.send({ success: true, data: result[0], message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/dashboard/total/delivery/orders', async (req, res, next) => {
    try {
        const { startDate, endDate, hubid } = req.query;
        const dashboardController = new DashboardController();
        const result = await dashboardController.getTotalDeliveryOrders({ startDate, endDate, hubid });
        res.send({ success: true, data: result, message: 'Data Retrieved' });
    } catch (exception) {
        console.error(exception.message || exception)
        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/dashboard/total/riders', async (req, res, next) => {
    try {

        const { startDate, endDate, hubid } = req.query;

        const user_id = req.header("x-userid");

        const filters = { startDate, endDate }

        const dashboardController = new DashboardController();

        const result = await dashboardController.getTotalRidersCount(filters, hubid);

        res.send({ success: true, data: result[0], message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/dashboard/working/riders', async (req, res, next) => {
    try {

        const { startDate, endDate, hubid } = req.query;

        const user_id = req.header("x-userid");

        const filters = { startDate, endDate, hubid }

        const dashboardController = new DashboardController();

        const result = await dashboardController.getWorkingRiderCount(filters, user_id);

        res.send({ success: true, data: result[0], message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/dashboard/pickup', async (req, res, next) => {
    try {

        const { startDate, endDate, hubid } = req.query;

        const user_id = req.header("x-userid");

        const filters = { startDate, endDate }

        const dashboardController = new DashboardController();

        const result = await dashboardController.getPickupCount(filters, hubid);

        res.send({ success: true, data: result[0], message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/dashboard/userswisehub/list', async (req, res, next) => {
    try {

        const user_id = req.header("x-userid");
        const { is_gateway } = req.query;


        const dashboardController = new DashboardController();

        const result = await dashboardController.getUserWiseHubList(user_id, is_gateway);

        res.send({ success: true, data: result, message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/dashboard/unassignedtrip/delivery', async (req, res, next) => {
    try {

        const { startDate, endDate, hubid } = req.query;

        const user_id = req.header("x-userid");

        const filters = { startDate, endDate, hubid }

        const dashboardController = new DashboardController();

        const result = await dashboardController.getUnassignedTripCountDelivery(filters, user_id);

        res.send({ success: true, data: result[0], message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/dashboard/unassignedtrip/pickup', async (req, res, next) => {
    try {

        const { startDate, endDate, hubid } = req.query;

        const user_id = req.header("x-userid");

        const filters = { startDate, endDate, hubid }

        const dashboardController = new DashboardController();

        const result = await dashboardController.getUnassignedTripCountPickup(filters, user_id);

        res.send({ success: true, data: result[0], message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/dashboard/order/receive/pickup/app', async (req, res, next) => {
    try {
        const { hubid: hubId, days } = req.query;

        const dashboardController = new DashboardController();
        const remark = `Picked-up`
        const status = 4
        const result = await dashboardController.getDashbordOrderGraphData({ hubId, days, remark, status });
        res.send({ success: true, data: result, message: 'Data Retrieved' });
    } catch (exception) {
        console.error(exception.message || exception)
        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/dashboard/order/receive/pickup/web', async (req, res, next) => {
    try {
        const { hubid: hubId, days } = req.query;
        const dashboardController = new DashboardController();
        const remark = `Picked-up (hub)`
        const status = 4
        const result = await dashboardController.getDashbordOrderGraphData({ hubId, days, remark, status });
        res.send({ success: true, data: result, message: 'Data Retrieved' });
    } catch (exception) {
        console.error(exception.message || exception)
        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/dashboard/dropoff-order-graph', async (req, res, next) => {
    try {
        const { hubid: hubId, days } = req.query;
        const dashboardController = new DashboardController();
        const status = 18
        const result = await dashboardController.getDashbordOrderGraphData({ hubId, days, status });
        res.send({ success: true, data: result, message: 'Data Retrieved' });
    } catch (exception) {
        console.error(exception.message || exception)
        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/dashboard/distance/covered', async (req, res, next) => {
    try {
        const { startDate, endDate, hubid, days } = req.query;

        const user_id = req.header("x-userid");

        const filters = { startDate, endDate, hubid, days }

        const dashboardController = new DashboardController();

        const result = await dashboardController.getDistanceCovered(filters, user_id);

        res.send({ success: true, data: result, message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})



router.get('/dashboard/pendingpickupreq', async (req, res, next) => {
    try {

        const { startDate, endDate, hubid } = req.query;

        const user_id = req.header("x-userid");

        const filters = { startDate, endDate }

        const dashboardController = new DashboardController();

        const result = await dashboardController.getPendingPickupReq(filters, hubid);

        res.send({ success: true, data: result[0], message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/dashboard/failedpickupreq', async (req, res, next) => {
    try {

        const { startDate, endDate, hubid } = req.query;

        const user_id = req.header("x-userid");

        const filters = { startDate, endDate }

        const dashboardController = new DashboardController();

        const result = await dashboardController.getfailedPickupReq(filters, hubid);

        res.send({ success: true, data: result[0], message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/dashboard/completedPickupReq', async (req, res, next) => {
    try {

        const { startDate, endDate, hubid } = req.query;

        const user_id = req.header("x-userid");

        const filters = { startDate, endDate }

        const dashboardController = new DashboardController();

        const result = await dashboardController.completedPickupReq(filters, hubid);

        res.send({ success: true, data: result[0], message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/dashboard/partialPickupReq', async (req, res, next) => {
    try {

        const { startDate, endDate, hubid } = req.query;

        const user_id = req.header("x-userid");

        const filters = { startDate, endDate }

        const dashboardController = new DashboardController();

        const result = await dashboardController.partialPickupReq(filters, hubid);

        res.send({ success: true, data: result[0], message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/dashboard/hubWiseOrders', async (req, res, next) => {
    try {

        const { days } = req.query;

        if (days === 'undefined' || days === 'null') {
            res.send({ success: true, data: [], message: 'Data Retrieved' });
            return
        }

        if (!days) throw new Error("Please provide no of days");

        const user_id = req.header("x-userid");

        const dashboardController = new DashboardController();

        const result = await dashboardController.getHubWiseOrders(days, user_id);

        res.send({ success: true, data: result, message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

module.exports = router;
