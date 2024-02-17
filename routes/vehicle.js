"use strict";

const express = require('express');
const router = express.Router()
const VEHICLE_CONTROLLER = require('../controller/vehicle');


router.get('/vehicle/all/list', async (req, res, next) => {
    try {

        const { page, offset } = req.query;

        const user_id = req.header("x-userid");

        const filters = { page, offset };

        const VEHICLE = new VEHICLE_CONTROLLER();

        let result = await VEHICLE.getVehicleData(filters);

        res.send({ success: true, data: result.data, hasNext: result.hasNext, hasPrev: result.hasPrev, message: 'Data retrieved' });

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})

router.post('/vehicle/add', async (req, res, next) => {
    try {

        const { vehicle_type, length, width, height, max_weight } = req.body;

        if(Number(max_weight) <= 0){
            throw new Error("Weight can not be less than or equal to 0")
        }
        if(Number(length) <= 0){
            throw new Error("Length can not be less than or equal to 0")
        }
        if(Number(width) <= 0){
            throw new Error("Width can not be less than or equal to 0")
        }
        if(Number(height) <= 0){
            throw new Error("Height can not be less than or equal to 0")
        }
       
        const VEHICLE = new VEHICLE_CONTROLLER();

        const result = await VEHICLE.addVehicle( vehicle_type, length, width, height, max_weight );

        res.send({ success: true, message: 'Vehicle added successfully' });

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})

router.post('/vehicle/edit', async (req, res, next) => {
    try {

        const { vehicle_type, length, width, height, max_weight, id } = req.body;
        
        if(Number(max_weight) <= 0){
            throw new Error("Weight can not be less than or equal to 0")
        }
        if(Number(length) <= 0){
            throw new Error("Length can not be less than or equal to 0")
        }
        if(Number(width) <= 0){
            throw new Error("Width can not be less than or equal to 0")
        }
        if(Number(height) <= 0){
            throw new Error("Height can not be less than or equal to 0")
        }

        const VEHICLE = new VEHICLE_CONTROLLER();

        const result = await VEHICLE.editVehicle( vehicle_type, length, width, height, max_weight, id);

        res.send({ success: true, data: result, message: 'Vehicle updated successfully' });

    } catch (exception) {
        console.error(exception.message || exception);
        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/vehicle/vehicles-list', async(req, res) => {
    try {
        const VEHICLE = new VEHICLE_CONTROLLER();
        let result = await VEHICLE.getAllVehicleList();
        res.send({ success: true, data: result, message: 'Data retrieved' });
    }
    catch(exception) {
        console.error(exception);
        res.send({ success: false, message: exception.message || exception });
    }
})

router.get('/vehicle/:id', async (req, res, next) => {
    try {

        const { id } = req.params;
        const user_id = req.header("x-userid");

        const VEHICLE = new VEHICLE_CONTROLLER();

        let result = await VEHICLE.getSinglevehicleData(id, user_id);

        res.send({ success: true, data: result, message: 'Data retrieved' });

    } catch (exception) {
        console.error(exception.message || exception);

        res.send({ success: false, message: exception.message || exception });
    }
})


module.exports = router;