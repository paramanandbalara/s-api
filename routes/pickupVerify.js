const express = require('express');
const router = express.Router();
const PICKUP_VERIFY_CONTROLLER = require('../controller/pickupVerify');

router.get('/pickup/details', async (req, res) => {
    try {
        const rider_id = req.header('x-userid'); 

        const { route_request_assigned_id } = req.query;

        const PICKUP_VERIFY = new PICKUP_VERIFY_CONTROLLER();

        const result = await PICKUP_VERIFY.getPickupDetails(route_request_assigned_id, rider_id );

        res.send({ success: true, data: result, message: 'Data Retrieved' });

    } catch (exception){
        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });
    }
})


router.post('/pickup/sendotp', async (req, res) => {
    try {

        const PICKUP_VERIFY = new PICKUP_VERIFY_CONTROLLER();

        const result = await PICKUP_VERIFY.sendVerifyOTP(req, res);

        res.send(result);

    } 
    catch (exception) {
        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });
    }
})

router.post('/pickup/verify', async (req, res) => {
    try {

        const PICKUP_VERIFY = new PICKUP_VERIFY_CONTROLLER();

        const rider_id = req.header('x-userid'); 

        const otp_token = req.header('otp_token');

        const body = req.body

        await PICKUP_VERIFY.verifyPickupOTP(otp_token, rider_id, body);

        res.send({ success: true, message: 'Pickup completed successfully'});

    } 
    catch (exception) {
        res.send({ success: false, message: exception.message || exception });
    }
})


router.post('/pickup/signatureverify', async ( req, res, next ) => {
    try {

        const  body  = req.body;

        const rider_id = req.header('x-userid'); 

        const PICKUP_VERIFY = new PICKUP_VERIFY_CONTROLLER();

        await PICKUP_VERIFY.pickupSignature(body, rider_id)

        return res.send({ "success": true, "message": "Pickup completed successfully"});

    }
    catch(error) {
        console.error(__line, error);
        return res.send({ "success": false, "message": "Error while updating signature : " + error.message || error });

    }
})


router.post('/pickup/complete', async (req, res) => {
    try {
        const body = Object.assign({}, req.body)

        const { pickup_request_no, route_request_assigned_id } = body;

        const PICKUP_VERIFY = new PICKUP_VERIFY_CONTROLLER();

        await PICKUP_VERIFY.pickupComplete(pickup_request_no, route_request_assigned_id);

        return res.send({ success: true, message: 'Pickup completed successfully' });

    } catch (exception) {

        console.error(exception.message || exception)

        return res.send({ success: false, message: exception.message });
    }
})


module.exports = router;

