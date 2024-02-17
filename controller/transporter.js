'use strict';

const TRANSPORTER_MODEL = require('../models/transporter');

class Transporter{
    static DEFAULT_PAGE = 1;
    static DEFAULT_LIMIT = 25;

    async addTransporter(hub_id, name, mode) {
        try {

            let insert_obj = {
                hub_id : hub_id,
                name : name,
                mode : mode
            }
            let result = await TRANSPORTER_MODEL.addTransporter(insert_obj);

            return result;
        }
        catch (exception) {
            console.error(exception)
            throw new Error(exception.message || exception);
        }
    }

    async editTransporter(id, name, mode) {
        try {

            let update_obj = {
                name : name,
                mode : mode
            }
            let result = await TRANSPORTER_MODEL.editTransporter(id, update_obj);

            return result;
        }
        catch (exception) {
            console.error(exception)
            throw new Error(exception.message || exception);
        }
    }

    async transporterEditFetch(id) {
        try {

            let result = await TRANSPORTER_MODEL.transporterList(null, null, id);

            return result;
        }
        catch (exception) {
            console.error(exception)
            throw new Error(exception.message || exception);
        }
    }

    async transporterList(filters) {
        try {
            let hasNext = false, hasPrev = false;

            const page = parseInt(filters.page ?? Transporter.DEFAULT_PAGE);

            let limit = parseInt(filters.offset ?? Transporter.DEFAULT_LIMIT);

            const offset = (page - 1) * limit;

            let result = await TRANSPORTER_MODEL.transporterList(offset, limit + 1, null, filters);

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
}

module.exports = Transporter;