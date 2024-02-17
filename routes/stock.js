const express = require('express');
const router = express.Router()
const STOCK_CONTROLLER = require('../controller/stock')

router.post('/stock/add', async (req, res, next) => {
    try{
        const { hub_id, bag_count, seal_count } = req.body;

        if(bag_count <= 0 || seal_count <= 0)
            throw new Error("Bag/Seal count can not be less than 1")

        const STOCK = new STOCK_CONTROLLER();

        await STOCK.insertStockData( hub_id, bag_count, seal_count );

        res.send({ success: true, message: 'Bag and bag seals added to your HUB'});
    }
    catch(error) {
        console.error(__line, error);
        res.send({ success: false, message: error.message || error });

    }
})

router.get('/stock/all/list', async (req, res, next) => {
    try {

        const { page, offset, hub_code, hub_city } = req.query;

        const filters = { page, offset, hub_code, hub_city };

        const STOCK = new STOCK_CONTROLLER();

        let result = await STOCK.getStockData(filters);

        res.send({ success: true, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, message: 'Data retrieved' });

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/stock/:stockid', async (req, res, next) => {
    try {

        const { stockid } = req.params;

        const STOCK = new STOCK_CONTROLLER();

        let result = await STOCK.getSingleStockData(stockid);

        res.send({ success: true, data: result, message: 'Data retrieved' });

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})

router.post('/stock/edit/:id', async (req, res, next) => {
    try {

        const {id} = req.params

        const { hub_id, bag_count, seal_count } = req.body;

        if(bag_count <= 0 || seal_count <= 0)
            throw new Error("Bag/Seal count can not be less than 1")

        const STOCK = new STOCK_CONTROLLER();

        await STOCK.editStock( hub_id, bag_count, seal_count, id);

        res.send({ success: true, message: 'Inventory updated successfully' });

    } catch (exception) {
        console.error(exception.message || exception);
        res.send({ success: false, message: exception.message || exception });
    }
})




module.exports = router;
