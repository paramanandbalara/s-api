const express = require('express');
const router = express.Router()

const INBOUND_CONTROLLER = require('../controller/inbound')
const DropOffController = require('../controller/dropoff')

router.post('/inbound/bag/scan', async (req, res) => {
    try {

        const { code, gateway_id } = req.body;

        if (!gateway_id) {
            throw new Error("Please select gateway")
        }

        const user_id = req.header('x-userid')

        const INBOUND = new INBOUND_CONTROLLER();

        const result = await INBOUND.getInboubdBagDetails(code, user_id, gateway_id);
        
        res.send({ success: true, data : result, message : 'Bag details retrieved' })

    } catch (exception) {

        console.error(exception);

        res.send({ success: false, message: exception.message })
    }
})

router.post('/inbound/order/scan', async (req, res) => {
    try {


        const { awb, bag_id } = req.body;

        if (!awb || !bag_id) {
            throw new Error('AWB or Bag not found')
        }

        const INBOUND = new INBOUND_CONTROLLER();

        const result = await INBOUND.inboundOrder(awb, bag_id);


        res.send({ success: true,  message: 'Reached at gateway' })

    } catch (exception) {

        console.error(exception);

        res.send({ success: false, message: exception.message })
    }
})

router.get('/inbound/missingorder/:bag_id', async (req, res) => {
    try {

        const { bag_id } = req.params;
        const user_id = req.header('x-userid')

        const INBOUND = new INBOUND_CONTROLLER();

        const result = await INBOUND.getMissingOrder(user_id, bag_id);

        if (!result.length) {
            res.send({ success: true, data: result, message: 'No orders missing in bag' })
        }
        else {
            res.send({ success: true, data: result, message: 'Here is the list of missing orders in bag' })
        }

    } catch (exception) {

        console.error(exception);

        res.send({ success: false, message: exception.message })
    }
})


router.post('/inbound/complete/:bag_id', async (req, res) => {
    try {

        const { bag_id } = req.params;
        const user_id = req.header('x-userid')
        const body = req.body;

        const INBOUND = new INBOUND_CONTROLLER();

        const result = await INBOUND.completeInbound(user_id, bag_id, body);

        res.send({ success: true, message: 'Inbound completed' })

    } catch (exception) {

        console.error(exception);

        res.send({ success: false, message: exception.message })
    }
})

router.get('/inbound/bag/list', async (req, res) => {
    try {
        const { page, offset, gateway_id} = req.query;

        const INBOUND = new INBOUND_CONTROLLER();

        const result = await INBOUND.inboundBagList(page, offset, gateway_id);

        res.send({ success: true, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, message: 'Data retrieved' });

    } catch (exception) {

        console.info(exception);

        res.send({ success: false, message: exception.message })
    }
})

router.get('/inbound/export', async (req, res) => {
    try {
        const { startDate, endDate, gateway_id } = req.query;

        if (!gateway_id) {
            throw new Error("Please select gateway")
        }
        const INBOUND = new INBOUND_CONTROLLER();

        const result = await INBOUND.exportBagDetails({ startDate, endDate }, gateway_id);

        res.send({ success: true, data: result, message: 'Data retrieved' });

    } catch (exception) {

        console.error(exception);

        res.send({ success: false, message: exception.message })
    }
})

router.post('/inbound/droppedoff', async (req, res) => {
    try {

        const { awb, hub_id, gateway_id } = req.body;

        const dropOffController = new DropOffController();

        const result = await dropOffController.dropOffOrder(awb, hub_id || gateway_id);

        res.send({ success: true, message: 'Drop off completed' })

    } catch (exception) {

        console.error(exception);

        res.send({ success: false, message: exception.message })
    }
})

router.get('/inbound/droppedoff', async (req, res) => {
    try {

        const { page, offset, hub_id, gateway_id, startDate, endDate } = req.query;

        const dropOffController = new DropOffController();

        const result = await dropOffController.droppedOffList({ page, offset, hub_id: hub_id || gateway_id, startDate, endDate });

        res.send({ success: true, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, message: 'Data retrieved' });

    } catch (exception) {

        console.error(exception);

        res.send({ success: false, message: exception.message })
    }
})

module.exports = router;