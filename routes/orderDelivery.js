const APP_AUTH = require('../modules/authorization/appAuth')
const express = require('express');
const router = express.Router()
const ORDER_DELIVERY_CONTROLLER = require('../controller/orderDelivery')
const ROUTE_ASSIGNMENT = require('../controller/routeAssignment')


router.post('/delivery/complete', async (req, res) => {
    try {
        const body = Object.assign({}, req.body)

        const { delivery_request_no, route_request_assigned_id } = body;
        const ORDER_DELIVERY = new ORDER_DELIVERY_CONTROLLER();

        await ORDER_DELIVERY.deliveryComplete(delivery_request_no, route_request_assigned_id);

        return res.send({ success: true, message: 'Delivery completed successfully' });

    } catch (exception) {

        console.error(exception.message || exception)

        return res.send({ success: false, message: exception.message });
    }
})

router.post('/rider/scan/deliveryupdate', async (req, res, next) => {
    try {
        const ORDER_DELIVERY = new ORDER_DELIVERY_CONTROLLER();

        const result = await ORDER_DELIVERY.updateRiderDeliveryScan(req.body)

        return res.send({ success: true, data: result, message: "Scan completed" });

    } catch (error) {
        console.error(error)
        return res.send({ "success": false, "message": error.message || error });
    }
})

router.post('/routeassignment/delivery/riderassign', async (req, res) => {
    try {
        const body = Object.assign({}, req.body)

        const { delivery_request_no, rider_id } = body;
        
        const user_id = req.header('x-userid')
        const ORDER_DELIVERY = new ORDER_DELIVERY_CONTROLLER();

        await ORDER_DELIVERY.assignDeliveryRider(delivery_request_no, rider_id, user_id);

        return res.send({ success: true, message: `Rider assigned successfully` });

    } catch (exception) {

        console.error(exception.message || exception)

        return res.send({ success: false, message: exception.message });
    }
})

router.get('/routeassignment/deliverytrip', async (req, res) => {
    try {
        const source = req.header("source");//source =2 for mobile app

        const user_id = req.header("x-userid")

        const { page, offset, startDate, endDate, pickup_state } = req.query;

        let filters = { page, offset, startDate, endDate, pickup_state }
        const ORDER_DELIVERY = new ORDER_DELIVERY_CONTROLLER();

        const result = await ORDER_DELIVERY.getDeliveryTrips(filters, user_id, source)

        res.send({ success: true, message: `Delivery orders data retrieved`, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, scan_awb_limit_count: result.scan_awb_limit_count });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message });
    }
})

router.get('/routeassignment/deliveryorder', async (req, res) => {
    try {
        const user_id = req.header("x-userid")

        const { page, offset, startDate, endDate, state, pincodes, rider_id, status, delivery_request_no, codes : hub_code, cities  } = req.query;

        const ORDER_DELIVERY = new ORDER_DELIVERY_CONTROLLER();

        const result = await ORDER_DELIVERY.getDeliveryRequestData({ page, offset, startDate, endDate, state, pincodes, rider_id, status, delivery_request_no, hub_code, cities }, user_id)

        res.send({ success: true, message: `Deliver orders data retrieved`, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message });
    }
})

router.get('/routeassignment/delivery/timeline', async (req, res) => {
    try {

        const { delivery_request_no, page, offset, deliver_request_id } = req.query;

        const ROUTE_ASSIGNMENT_CONTROLLER = new ROUTE_ASSIGNMENT()

        const result = await ROUTE_ASSIGNMENT_CONTROLLER.getDeliveryRequestsTimeline(delivery_request_no, page, offset, deliver_request_id);

        res.send({ success: true, message: `Data Retrieved`, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message });
    }
})


router.get('/delivery/details', async (req, res) => {
    try {
        const rider_id = req.header('x-userid');

        const { delivery_request_no, route_request_assigned_id } = req.query;
        const ORDER_DELIVERY = new ORDER_DELIVERY_CONTROLLER();

        let result = await ORDER_DELIVERY.getDeliveryDetails(delivery_request_no, route_request_assigned_id, rider_id)

        res.send({ success: true, data: result, message: 'Data Retrieved' });

    } catch (exception) {
        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });
    }
})

router.post('/delivery/sendotp', async (req, res) => {
    try {
        const ORDER_DELIVERY = new ORDER_DELIVERY_CONTROLLER();

        const result = await ORDER_DELIVERY.sendVerifyOTP(req, res);
        res.send(result);

    } 
    catch (exception) {
        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });
    }
})

router.post('/delivery/verify', async (req, res) => {
    try {

        const rider_id = req.header('x-userid'); 

        const otp_token = req.header('otp_token');

        const body = req.body
        const ORDER_DELIVERY = new ORDER_DELIVERY_CONTROLLER();

        await ORDER_DELIVERY.verifyPickupOTP(otp_token, rider_id, body);

        res.send({ success: true, message: 'Delivery completed successfully'});

    } 
    catch (exception) {
        res.send({ success: false, message: exception.message || exception });
    }
})

router.post('/delivery/signatureverify', async ( req, res, next ) => {
    try {
        const rider_id = req.header('x-userid'); 

        const body = req.body;

        body['rider_id'] = rider_id
        
        const ORDER_DELIVERY = new ORDER_DELIVERY_CONTROLLER();

        await ORDER_DELIVERY.verifySignature(body, req.files)

        return res.send({ "success": true, "message": "Delivery completed successfully"});

    }
    catch(error) {
        console.error(__line, error);
        return res.send({ "success": false, "message": "Error while updating signature : " + error.message || error });

    }
})

router.get('/routeassignment/delivery/run/sheet', async (req, res) => {
    try {

        const { rider_id } = req.query;

        if(!rider_id){
            throw new Error("Rider Id not found");
        }

        const ROUTE_ASSIGNMENT_CONTROLLER = new ROUTE_ASSIGNMENT()

        const result = await ROUTE_ASSIGNMENT_CONTROLLER.generateDeliveryPdf( rider_id )

        res.send({ success: true, message: `PDF generated successfully`, filepath: result });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message });
    }
})

router.get('/delivery/count', async (req, res) => {
    try {
        const rider_id = req.header('x-userid');
        const ORDER_DELIVERY = new ORDER_DELIVERY_CONTROLLER();

        let result = await ORDER_DELIVERY.getTripCountByRiderId(rider_id, 2)

        res.send({ success: true, data: result, message: 'Data Retrieved' });

    } catch (exception) {
        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/pickup/count', async (req, res) => {
    try {
        const rider_id = req.header('x-userid');

        const ORDER_DELIVERY = new ORDER_DELIVERY_CONTROLLER();

        let result = await ORDER_DELIVERY.getTripCountByRiderId(rider_id, 1)

        res.send({ success: true, data: result, message: 'Data Retrieved' });

    } catch (exception) {
        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });
    }
})

module.exports = router;