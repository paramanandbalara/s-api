const APP_AUTH = require('../modules/authorization/appAuth')
const express = require('express');
const router = express.Router()
const { receiveOrders } = require('../modules/orderReceive')

router.post('/order/create', APP_AUTH.isAppAuthorized, async (req, res, next) => {
    try {
        const { orders } = req.body;
        await receiveOrders(orders)

        res.send({ success: true,  message: 'Orders received' });

    } catch (exception) {
        res.send({ success: false, message: exception.message || exception });
    }
})


module.exports = router;