const express = require('express');
const router = express.Router()
const INVENTORY_CONTROLLER = require('../controller/inventoryRecon')

router.get('/inventory/inscanned/awb', async (req, res, next) => {
    try {
        const { startDate, endDate, hub_id } = req.query;

        const filters = { startDate, endDate, hub_id };

        const INVENTORY = new INVENTORY_CONTROLLER();

        const result = await INVENTORY.getInScannedAwbsCount( filters );

        res.send({ success: true, data: result[0], message: 'Data Retrieved' });
    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/inventory/bagged/awb', async (req, res, next) => {
    try {
        const { startDate, endDate, hub_id } = req.query;

        const filters = { startDate, endDate, hub_id };

        const INVENTORY = new INVENTORY_CONTROLLER();

        const result = await INVENTORY.getBaggedAwbsCount( filters );

        res.send({ success: true, data: result[0], message: 'Data Retrieved' });

    }
    catch (error) {
        console.error(__line, error);
        res.send({success : false, message : error.message || error});
    }
})

router.get('/inventory/outscanned/awb', async ( req, res, next ) => {
    try {
        const { startDate, endDate, hub_id } = req.query;
        const filters = { startDate, endDate, hub_id };

        const INVENTORY = new INVENTORY_CONTROLLER();

        const result = await INVENTORY.getOutScannedAwbsCount( filters );

        res.send({ success: true, data: result[0], message: 'Data Retrieved' });
    }
    catch (error) {
        console.error(__line, error);
        res.send({success : false, message : error.message || error});
    }
})

router.get('/inventory/export', async ( req, res, next ) => {
    try {
        const { startDate, endDate, hub_id } = req.query;

        const filters = { startDate, endDate, hub_id };

        const INVENTORY = new INVENTORY_CONTROLLER();

        const result = await INVENTORY.getInventoryExport( filters );

        res.send({ success: true, filepath: result, message: 'Data Retrieved' });
    }
    catch (error) {
        console.error(__line, error);
        res.send({success : false, message : 'Something went wrong'});
    }

})

router.get('/inventory/recon', async ( req, res, next ) => {
    try {
        const { startDate, endDate, page, offset, hub_id } = req.query
        const filters = { startDate, endDate, page, offset, hub_id };

        const INVENTORY = new INVENTORY_CONTROLLER();

        const result = await INVENTORY.getInventoryData( filters );

        res.send({ success: true, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, message: 'Data Retrieved' });

    }
    catch (error) {
        console.error(__line, error);
        res.send({success : false, message : error.message || error});
    }

})



module.exports = router;
