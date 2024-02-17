"use strict";

const routes = require('../models/routes')

class ManageRoutes {

    async setNewRoutesGroup(new_routes_group) {
        try {
            const result = await routes.setNewRoutesGroup(new_routes_group);
            return result;

        }
        catch (exception) {
            console.error(exception.message);
            throw new Error(exception.message)
        }
    }


    async getRoutes(route_group_ids) {

        try {
            const result = await routes.getRoutes(route_group_ids)
            return result;
        }
        catch (exception) {
            console.error(exception.message);
            throw new Error(exception.message)
        }
    }


    async getRoutesGroup() {
        try {
            const result = await routes.getRoutesGroup();
            return result;

        }
        catch (exception) {
            console.error(exception.message);
            throw new Error(exception.message)
        }
    }


    async updateRoutesGroupId(routes_grouping_id, route_id) {
        try {
            const result = await routes.updateRoutesGroupId(routes_grouping_id, route_id);
            return result;

        }
        catch (exception) {
            console.error(exception.message);
            throw new Error(exception.message)
        }
    }

    async saveOrEditRoutes(data) {
        try {
            const result = await routes.saveOrEditRoutes(data)
            return result[0];
        }
        catch (exception) {
            console.error(exception.message);
            throw new Error(exception.message)
        }
    }

    async inactiveRolesRoutes(role_id, rejected_routes = []) {
        try {
            const result = await routes.inactiveRolesRoutes(role_id, rejected_routes)            
            return result;
        }
        catch (exception) {
            console.error(exception.message);
            throw new Error(exception.message)
        }
    }

    async getParticularRoleDetail(id) {
        try {
            const result = await routes.getParticularRoleDetail(id)
            return result[0];
        }
        catch (exception) {
            console.error(exception.message);
            throw new Error(exception.message)
        }
    }

    async getParticularRoutesAuth(role_id) {

        try {
            const result = await routes.getParticularRoutesAuth(role_id)
            return result;
        }
        catch (exception) {
            console.error(exception.message);
            throw new Error(exception.message)
        }
    }

}

module.exports = ManageRoutes;