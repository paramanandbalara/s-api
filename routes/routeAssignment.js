"use strict";

const express = require('express');
const router = express.Router();
const RouteAssignmentController = require('../controller/routeAssignment')
const PickupRequestController = require('../controller/pickup_request');
const PickupVerifyController = require('../controller/pickupVerify');


router.get('/routeassignment/riderlist', async (req, res) => {
    try {

        const user_id = req.header("x-userid");
        const routeAssignmentController = new RouteAssignmentController();

        const result = await routeAssignmentController.getRiders(user_id)

        res.send({ success: true, message: `Riders data Retrieved`, data: result });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message });
    }
})

router.get('/routeassignment/pickuporder', async (req, res) => {
    try {
        const user_id = req.header("x-userid")
        const { page, offset, startDate, endDate, state : pickup_state, status, rider_id, sy_warehouse_id, pincodes, pickup_request_no, codes : hub_code, cities : city } = req.query;
        const routeAssignmentController = new RouteAssignmentController();

        const result = await routeAssignmentController.getPickupRequestsList({ page_no : page, offset, startDate, endDate, pickup_state, status, rider_id, sy_warehouse_id, pincodes, pickup_request_no, user_id, hub_code, city})

        res.send({ success: true, message: `Pickup Orders data Retrieved`, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message });
    }
})

router.get('/routeassignment/pickuptrips', async (req, res) => {
    try {
        const source = req.header("source");//source =2 for mobile app

        const user_id = req.header("x-userid")

        const { page, offset, startDate, endDate, pickup_state } = req.query;
        const routeAssignmentController = new RouteAssignmentController();

        const result = await routeAssignmentController.getPickupTrips(user_id, page, offset, startDate, endDate, source, pickup_state)

        res.send({ success: true, message: `Pickup Orders data Retrieved`, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, scan_awb_limit_count: result.scan_awb_limit_count });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message });
    }
})

router.get('/routeassignment/pickup/run/sheet', async (req, res) => {
    try {

        const { rider_id } = req.query;

        if(!rider_id){
            throw new Error("Rider Id not found");
        }
        const routeAssignmentController = new RouteAssignmentController();

        const result = await routeAssignmentController.generatePdf( rider_id )

        res.send({ success: true, message: `PDF generated successfully`, filepath: result });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message });
    }
})


router.post('/routeassignment/riderassign', async (req, res) => {
    try {
        const body = Object.assign({}, req.body)

        const { pickup_request_no, rider_id } = body;
        const user_id = req.header('x-userid')
        //rider_id is user_id with rider role
        const pickupRequestController = new PickupRequestController();

        await pickupRequestController.assignRider(pickup_request_no, rider_id, user_id);

        return res.send({ success: true, message: `Rider assigned successfully` });

    } catch (exception) {

        console.error(exception.message || exception)

        return res.send({ success: false, message: exception.message });
    }
})

router.get('/routeassignment/pickuplocation', async (req, res) => {
    try {

        const { hub_id } = req.query;
        const routeAssignmentController = new RouteAssignmentController();

        const result = await routeAssignmentController.getPickupRequestsByHubId(hub_id);        res.send({ success: true, message: `Data Retrieved`, data: result.data});

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message });
    }
})

router.post('/pickup/complete', async( req, res) => {
    try {
        const body = Object.assign({}, req.body)

        const { pickup_request_no, route_request_assigned_id } = body;
       
        const pickupVerifyController = new PickupVerifyController();

        await pickupVerifyController.pickupComplete(pickup_request_no, route_request_assigned_id);

        return res.send({ success: true, message: 'Pickup completed successfully' });

    } catch (exception) {

        console.error(exception.message || exception)

        return res.send({ success: false, message: exception.message });
    }
})



router.get('/routeassignment/pickup/details', async (req, res) => {
    try {
        const { id : pickup_request_id } = req.query;
        const routeAssignmentController = new RouteAssignmentController();

        const result = await routeAssignmentController.getPickupRequestDetails(pickup_request_id);
        res.send({ success: true, message: `Data retrieved`, data: result });
    } catch (error) {
        console.error(error.message || error);
        res.status(500).send({ success: false, message: `Error: ${error.message}` });
    }
});



router.get('/routeassignment/pickup/orders/timeline', async (req, res) => {
    try {

        const { page, offset, pickup_request_id } = req.query;
        const routeAssignmentController = new RouteAssignmentController();

        const result = await routeAssignmentController.getPickupRequestsTimeline(pickup_request_id, page, offset);
        res.send({ success: true, message: `Data Retrieved`, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message });
    }
})

router.get('/routeassignment/pickuprequest/details/warehouse', async (req, res) => {
    try {
        const { pickup_request_id } = req.query;
        const routeAssignmentController = new RouteAssignmentController();

        const result = await routeAssignmentController.getWareHouseAndPrDetailsByPrId(pickup_request_id);
        res.send({ success: true, data: result, message: 'Data retrieved successfully.' });
    } catch (error) {
        console.error(error);
        res.send({ success: false, message: error.message || 'An error occurred.' });
    }
});




router.get('/routeassignment/delivery/details', async (req, res) => {
    try {
        const { id : delivery_request_id } = req.query;
        const routeAssignmentController = new RouteAssignmentController();

        const result = await routeAssignmentController.getDeliveryRequestDetails(delivery_request_id);
        res.send({ success: true, message: `Data retrieved`, data: result });
    } catch (error) {
        console.error(error.message || error);
        res.status(500).send({ success: false, message: `Error: ${error.message}` });
    }
});


router.get('/routeassignment/delivery/orders/timeline', async (req, res) => {
    try {

        const { page, offset, delivery_request_id } = req.query;
        const routeAssignmentController = new RouteAssignmentController();

        const result = await routeAssignmentController.getDeliveyRequestsTimeline(delivery_request_id, page, offset);
        res.send({ success: true, message: `Data Retrieved`, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message });
    }
})


router.get('/routeassignment/deliveryrequest/details/warehouse', async (req, res) => {
    try {
        const { delivery_request_id } = req.query;
        const routeAssignmentController = new RouteAssignmentController();

        const result = await routeAssignmentController.getWareHouseAndDeliveyDetails(delivery_request_id);
        res.send({ success: true, data: result, message: 'Data retrieved successfully.' });
    } catch (error) {
        console.error(error);
        res.send({ success: false, message: error.message || 'An error occurred.' });
    }
});


module.exports = router;