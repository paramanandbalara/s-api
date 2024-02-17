'use strict';

const VEHICLE_MODEL = require('../models/vehicle');

class Vehicle{
    static DEFAULT_PAGE = 1;
    static DEFAULT_LIMIT = 25;

    async getVehicleData(filters) {
        try {
            let hasNext = false, hasPrev = false;

            const page = parseInt(filters.page ?? Vehicle.DEFAULT_PAGE);

            let limit = parseInt(filters.offset ?? Vehicle.DEFAULT_LIMIT);

            const offset = (page - 1) * limit;

            let result = await VEHICLE_MODEL.vehicleList(offset, limit + 1);

            if (result.length == limit + 1) {
                hasNext = true;
            }

            if (page > 1) {
                hasPrev = true;
            }

            result = result.slice(0, limit);

            return { data: result, hasNext, hasPrev };

        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception)
        }
    }

    async getSinglevehicleData(id) {
        try {
            
            let result = await VEHICLE_MODEL.getSinglevehicleData(id);

            return result;
        }
        catch (exception) {
            console.error(exception)
            throw new Error(exception.message || exception);
        }
    }

    async editVehicle( vehicle_type, length, width, height, max_weight, id ) {
        try {

            let update_obj = {
                vehicle_type : vehicle_type,
                length : Number(length),
                width : Number(width),
                height : Number(height),
                max_weight : Number(max_weight)
            }
            let result = await VEHICLE_MODEL.editVehicle(update_obj, id);

            return result;
        }
        catch (exception) {
            console.error(exception)
            throw new Error(exception.message || exception);
        }
    }

    async addVehicle( vehicle_type, length, width, height, max_weight ) {
        try {

            let insert_obj = {
                vehicle_type : vehicle_type,
                length : Number(length),
                width : Number(width),
                height : Number(height) ,
                max_weight : Number(max_weight)
            }

            let result = await VEHICLE_MODEL.addVehicle(insert_obj);

            return result;
        }
        catch (exception) {
            console.error(exception)
            throw new Error(exception.message || exception);
        }
    }

    async getAllVehicleList() {
        try {
            let result = await VEHICLE_MODEL.getAllVehicleList();
            return result;
        }
        catch (exception) {
            console.error(exception)
            throw exception;
        }
    }
}

module.exports = Vehicle;