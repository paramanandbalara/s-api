const express = require('express');
const router = express.Router()
const ORDERS_CONTROLLER = require('../controller/orders')
const { validateEwayBillAdd, validateEwayBillEdit } = require('../validation/ewayBill')
const validateRequest = require('../middleware/reqValidator')

router.get('/orders/:status', async (req, res, next) => {
    try {
        const { page, offset, manifest_id, awb, warehouse_id, startDate, endDate, shypmax_id, filter_status } = req.query;

        const user_id = req.header("x-userid");

        const filters = { user_id, page, offset, manifest_id, awb, warehouse_id, startDate, endDate, shypmax_id, filter_status };

        const { status } = req.params;

        const ORDERS = new ORDERS_CONTROLLER();

        const result = await ORDERS.getOrders(filters, status)

        res.send({ success: true, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/orders/delivery/list', async (req, res, next) => {
    try {

        const { page, offset, awb, startDate, endDate, shypmax_id, filter_status, status } = req.query;

        const user_id = req.header("x-userid");

        const filters = { user_id, page, offset, awb, startDate, endDate, shypmax_id, filter_status };

        const ORDERS = new ORDERS_CONTROLLER();

        const result = await ORDERS.getDeliveryOrders(filters, status)

        res.send({ success: true, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/orders/order/tracking', async (req, res) => {
    try {

        let { id } = req.query;

        const ORDERS = new ORDERS_CONTROLLER();

        const result = await ORDERS.getOrdersTracking(id)

        res.send({ success: true, orderEvents: result.orderEvents, pickupData: result.pickupData, message: 'Data Retrieved' });

    }
    catch (exception) {
        throw new Error(exception.message || exception);
    }
})

router.get('/orders/order/delivery/tracking', async (req, res) => {
    try {

        let { id } = req.query;

        const ORDERS = new ORDERS_CONTROLLER();

        const result = await ORDERS.getDeliveryOrdersTracking(id)

        res.send({ success: true, orderEvents: result.orderEvents, deliveryData: result.deliveryData, message: 'Data Retrieved' });

    }
    catch (exception) {
        throw new Error(exception.message || exception);
    }
})


router.post('/orders/eway-billno/add', validateRequest(validateEwayBillAdd), async (req, res) => {
    try {
        const ORDERS = new ORDERS_CONTROLLER();
        await ORDERS.uploadEwayBill(req.body);
        res.send({ success: true, message: 'E-way Bill uploaded successfully' });
    }
    catch (exception) {
        console.error(exception);
        res.send({ success: false, message: exception.message || exception });
    }
})

router.post('/orders/eway-billno/edit', validateRequest(validateEwayBillEdit), async (req, res) => {
    try {
        const ORDERS = new ORDERS_CONTROLLER();
        await ORDERS.editEwayBill(req.body);
        res.send({ success: true, message: 'E-way Bill uploaded successfully' });
    }
    catch (exception) {
        console.error(exception);
        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/orders/eway-billno/details', async (req, res) => {
    try {
        const { shypmax_id } = req.query;
        if (!shypmax_id) throw new Error("Shypmax_id id not found");

        const ORDERS = new ORDERS_CONTROLLER();
        const result = await ORDERS.getEwayBillById(shypmax_id);
        res.send({ success: true, data: result, message: 'Data Retrieved' });
    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})



module.exports = router;
