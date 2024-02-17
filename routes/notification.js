"use strict"
const { Router } = require('express');
const router = Router()
const validateRequest = require('../middleware/reqValidator');
const NotificationController = require('../controller/notification');
const { notificationDetails } = require('../validation/appNotification');

router.get('/notification/unusual-rider-km', async (req, res, next) => {
    try {
        const userId = req.header('x-userid')
        const notificationController = new NotificationController();
        const result = await notificationController.unusualRiderKmNotification(userId);
        res.send({success : true, data : result})
    } catch (exception) {
        console.error(exception.message || exception)
        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/notification/rider-less-pickup', async (req, res, next) => {
    try {
        const userId = req.header('x-userid')
        const notificationController = new NotificationController();
        const result = await notificationController.riderLessPickupNotification(userId);
        res.send({ success: true, data: result })
    } catch (exception) {
        console.error(exception.message || exception)
        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/notification/mismatch-inscan-bagging-outscan', async (req, res, next) => {
    try {
        const userId = req.header('x-userid')
        const notificationController = new NotificationController();
        const result = await notificationController.mismatchInInscanBaggingOutscan(userId);
        res.send({ success: true, data: result })
    } catch (exception) {
        console.error(exception.message || exception)
        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/notification/less-bag-seal', async (req, res, next) => {
    try {
        const userId = req.header('x-userid')
        const notificationController = new NotificationController();
        const result = await notificationController.lessBeagSealNotification(userId);
        res.send({ success: true, data: result })
    } catch (exception) {
        console.error(exception.message || exception)
        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/notification/airwaybill-notupload', async (req, res, next) => {
    try {
        const userId = req.header('x-userid')
        const notificationController = new NotificationController();
        const result = await notificationController.airwayBillNotUploaded(userId);
        res.send({ success: true, data: result })
    } catch (exception) {
        console.error(exception.message || exception)
        res.send({ success: false, message: exception.message || exception });
    }
})


module.exports = router;