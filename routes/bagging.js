"use strict";

const express = require('express');
const router = express.Router()
const BaggingController = require('../controller/bagging')

router.post('/bagging/awb', async (req, res) => {
    try {
        const userId = req.header('x-userid');
        const { awb, hub_id, bag_type = 1 } = req.body || {};
        const baggingController = new BaggingController();
        const result = await baggingController.bagAwb({ awb, userId, hub_id, bagType : Number(bag_type) })

        res.send({ success: true, data: result, message: `AWB got added in bag` });

    } catch (exception) {
        console.error(exception.message || exception);
        res.send({ success: false, message: exception.message || exception });
    }
})

router.post('/bagging/bag/close', async (req, res) => {
    try {
        //TODO add max allowed width weight, height, length
        const body = Object.assign({}, req.body)
        const { bag_id, bag_sealno, bag_weight, bag_img, bag_img_type, hub_id, bag_length = 0, bag_width = 0, bag_height = 0 } = body;
        const baggingController = new BaggingController();
    
        await baggingController.closeBag({
            bagId: bag_id,
            bagSealNo: bag_sealno,
            bagWeight: bag_weight,
            bagImg: bag_img,
            bagImgType: bag_img_type,
            hubId: hub_id,
            bagLength: bag_length || 0,
            bagWidth: bag_width || 0,
            bagHeight: bag_height || 0,
        })

        res.send({ success: true, message: 'Bag closed successfully' });

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/bagging/closebag/list', async (req, res) => {
    try {
        const { page, offset, hub_id } = req.query;
        const baggingController = new BaggingController();
        const result = await baggingController.getClosedBagList(page, offset, hub_id);
        res.send({ success: true, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, message: 'Data retrieved' });
    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})


router.get('/bagging/openbag/list', async (req, res) => {
    try {
        const { hub_id : hubId} = req.query;
        const baggingController = new BaggingController();
        const result = await baggingController.getOpenBagList(hubId);
        res.send({ success: true, data: result, message: 'Data retrieved' });

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})


router.get('/bagging/baglabel/:bag_id', async (req, res) => {
    try {

        let user_id = req.header('x-userid')
        let { bag_id } = req.params;
        const { hub_id } = req.query;

        const baggingController = new BaggingController();

        const result = await baggingController.bagLabelData(bag_id, user_id, hub_id);

        res.send({ success: true, filepath: result, message: 'Data retrieved' });

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/bagging/isvalidbag/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const { hub_id } = req.query;

        const baggingController = new BaggingController();
        const result = await baggingController.checkIsValidBag(code, Number(hub_id));
        res.send({ success: true, data: result, message: 'Data retrieved' });

    } catch (exception) {
        console.error(exception.message || exception);
        res.send({ success: false, message: exception.message || exception });
    }
})



module.exports = router;