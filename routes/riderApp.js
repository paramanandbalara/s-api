const router = require('express').Router()
const OrdersController = require('../controller/orders')
const RiderController = require('../controller/rider')
const multer = require('multer');
const OS = require('os');
const { eWayBillRiderApp, validateAwb } = require('../validation/eWayBillRiderApp')
const validateRequest = require('../middleware/reqValidator')

const checkImageExtension = (req, file, cb) => {
    if (file.mimetype !== 'image/png' && file.mimetype !== 'image/jpg'
        && file.mimetype !== 'image/jpeg' && file.mimetype !== "application/pdf"
        && file.mimetype != "application/msword" && file.mimetype != "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        req.file_error = "Only pdf,png,jpg ,jpeg ,doc or docx files allowed";
        return cb(null, false);
    }
    cb(null, true);
}


router.post('/rider/scan/trackingUpdate', async (req, res, next) => {
    try {
        const ordersController = new OrdersController()
        const result = await ordersController.updateRiderAppScanResponse(req.body)

        return res.send({ success: true, data: result, message: "Scan completed" });

    } catch (error) {
        console.error(error)
        return res.send({ "success": false, "message": error.message || error });
    }
})

router.post('/rider/submit/securepickup', async (req, res) => {
    try {
        const ordersController = new OrdersController()
        const { awb, device_id, lat_long, pickup_request_id, route_request_assigned_id, sy_warehouse_id = null } = req.body;
        const result = await ordersController.updateSecurePickupItem({ awb, device_id, lat_long, pickup_request_id, route_request_assigned_id, sy_warehouse_id })
        return res.send({ success: true, data: result, message: "Scan completed" });

    } catch (error) {
        console.error(error)
        return res.send({ "success": false, "message": error.message || error });
    }
})

router.post('/rider/checksecurepickup', async (req, res, next) => {
    try {
        const { awb, pickup_request_id: pickupRequestId, route_request_assigned_id: routeRequestAssignedId } = req.body;
        if (!awb || !pickupRequestId || !routeRequestAssignedId) {
            throw new Error("Invalid request data");
        }
        const ordersController = new OrdersController()
        const result = await ordersController.checkWeatherAwbStatusForSecurePickup({ awb, pickupRequestId, routeRequestAssignedId })
        if (!result) {
            throw new Error("No data found")
        }
        return res.send({ success: true, data: result });

    } catch (error) {
        console.error(error)
        return res.send({ "success": false, "message": error.message || error });
    }
})

const uploadItemImage = multer({
    fileFilter: (req, file, cb) => { checkImageExtension(req, file, cb) }
}).fields([
    { name: "itemImage", maxCount: 1 }
])

router.post('/rider/uploadsecurepickupimage/item', uploadItemImage, async (req, res, next) => {
    try {
        const { awb, pickup_request_id: pickupRequestId, route_request_assigned_id: routeRequestAssignedId } = req.body;
        const riderController = new RiderController();
        const result = await riderController.uploadpackageAndParcelImage({ awb, pickupRequestId, routeRequestAssignedId, fileName: `${awb}_item`, file: req.files, key : 'itemImage' })
        return res.send({ success: true, data: result });
    } catch (error) {
        console.error(error)
        return res.send({ "success": false, "message": error.message || error });
    }
})

const uploadParcelImage = multer({
    fileFilter: (req, file, cb) => { checkImageExtension(req, file, cb) }
}).fields([
    { name: "parcelImage", maxCount: 1 }
])


router.post('/rider/uploadsecurepickupimage/parcel', uploadParcelImage, async (req, res, next) => {
    try {
        const { awb, pickup_request_id: pickupRequestId, route_request_assigned_id: routeRequestAssignedId, fileName } = req.body;
        const riderController = new RiderController();
        const result = await riderController.uploadpackageAndParcelImage({ awb, pickupRequestId, routeRequestAssignedId, fileName: `${awb}_package`, file: req.files, key: 'parcelImage' })
        return res.send({ success: true, data: result });
    } catch (error) {
        console.error(error)
        return res.send({ "success": false, "message": error.message || error });
    }
})


const riderCheckinImageFile = multer({
    fileFilter: (req, file, cb) => { checkImageExtension(req, file, cb) }
}).fields([
    { name: "checkin_selfie_", maxCount: 1 }
])

router.post('/rider/checkin/riderimage', (req, res, next) => {
    next()
}, riderCheckinImageFile, async (req, res, next) => {
    try {
        let user_id = req.header('x-userid')

        if (!user_id) {
            throw new Error("User id not found");
        }
        const body = req.body;

        body['user_id'] = user_id;

        const riderController = new RiderController();

        await riderController.insertRiderCheckinImage(body, req.files)
        return res.send({ "success": true, "message": " Image uploaded successfully" });

    }
    catch (error) {
        console.error(__line, error);
        return res.send({ "success": false, "message": "Error while checkin rider : " + error.message || error });

    }
})

const riderCheckinFile = multer({
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'image/png' && file.mimetype !== 'image/jpg'
            && file.mimetype !== 'image/jpeg' && file.mimetype !== "application/pdf"
            && file.mimetype != "application/msword" && file.mimetype != "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            req.file_error = "Only pdf,png,jpg ,jpeg ,doc or docx files allowed";
            return cb(null, false);
        }
        cb(null, true);
    }
}).fields([
    { name: "checkin_odometer_", maxCount: 1 }
])

router.post('/rider/checkin', riderCheckinFile, async (req, res, next) => {
    try {
        let user_id = req.header('x-userid')

        if (!user_id) {
            throw new Error("User id not found");
        }
        const body = req.body;

        body['user_id'] = user_id;

        const riderController = new RiderController();

        await riderController.insertRiderCheckinDate(body, req.files)
        return res.send({ "success": true, "message": " Rider checkin successfully" });

    }
    catch (error) {
        console.error(__line, error);
        return res.send({ "success": false, "message": "Error while checkin rider : " + error.message || error });

    }
})



const riderCheckoutFile = multer({
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'image/png' && file.mimetype !== 'image/jpg'
            && file.mimetype !== 'image/jpeg' && file.mimetype !== "application/pdf"
            && file.mimetype != "application/msword" && file.mimetype != "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            req.file_error = "Only pdf,png,jpg ,jpeg ,doc or docx files allowed";
            return cb(null, false);
        }
        cb(null, true);
    }
}).fields([{ name: "odometer_checkout_image_file", maxCount: 1 }]);

router.post('/rider/checkout', riderCheckoutFile, async (req, res, next) => {
    try {
        user_id = req.header('x-userid')

        if (!user_id) {
            throw new Error("User id not found");
        }
        const body = req.body;

        body['user_id'] = user_id;

        const riderController = new RiderController();

        const result = await riderController.insertRiderCheckoutDate(body, req.files)

        return res.send({ "success": true, "message": "Rider checkout successfully", data : result });
    }
    catch (error) {
        console.error(__line, error);
        return res.send({ "success": false, "message": "Error while checkout rider : " + error.message || error });

    }
})

router.get('/rider/trips/events', async (req, res) => {
    try {
        let { rider_id } = req.query;

        const riderController = new RiderController();

        let result = await riderController.getRiderTimeline(rider_id);

        res.send({ success: true, data: result.data, message: 'Data Retrieved' });

    }
    catch (exception) {
        console.error(__line, exception);

        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/rider/checkin/status', async (req, res, next) => {
    try {

        const rider_id = req.header('x-userid')

        const riderController = new RiderController();

        const result = await riderController.checkCheckinStatus(rider_id)

        return res.send({ "success": true, data: result });

    }
    catch (error) {
        console.error(__line, error);
        return res.send({ "success": false, "message": "Error while checkout rider : " + error.message || error });

    }
})


const eWayFile = multer({
    fileFilter: (req, file, cb) => { checkImageExtension(req, file, cb) }
}).fields([
    { name: "eWayFile", maxCount: 1 }
])


router.post('/rider/eway-bill', eWayFile, validateRequest(eWayBillRiderApp), async (req, res, next) => {
    try {
        const riderController = new RiderController();
        await riderController.eWayBillUpload(req.body, req.files)
        return res.send({ "success": true, "message": "E-way Bill uploaded successfully" });
    }
    catch (error) {
        console.error(__line, error);
        return res.send({ "success": false, "message": error.message || error });

    }
})

module.exports = router