"use strict";

const dashboardModel = require('../models/dashboard')
const { getAllHubsByUser } = require('../modules/userHub')
const USER_MODEL = require('../models/users')
const dayjs = require('dayjs');
const orderModel = require('../models/orders');

class Dashboard {

    async getTotalRidersCount(filters, hubid) {
        try {
            hubid = hubid.split(',')
            const TOTAL_RIDERS_COUNT = await dashboardModel.getTotalRidersCount(filters, hubid);

            return TOTAL_RIDERS_COUNT;

        }
        catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async getTotalOrders(filters, hubid) {
        try {

            hubid = hubid.split(',')
            const TOTAL_RIDERS_COUNT = await dashboardModel.getTotalOrders(filters, hubid);

            return TOTAL_RIDERS_COUNT;

        }
        catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async getTotalDeliveryOrders({ startDate = new Date(), endDate = new Date(), hubid }) {
        try {
            const hubIdsArr = (hubid ? hubid.split(',') : []).map(i => Number(i));
            startDate = dayjs(startDate).format('YYYY-MM-DD 00:00:00');
            endDate = dayjs(endDate).format('YYYY-MM-DD 23:59:59');
            const ordersCount = hubIdsArr.length ? await dashboardModel.getTotalDeliveryOrders({ startDate, endDate, hubIdsArr }) : [];
            return ordersCount.length ? ordersCount[0] : { totalDeliveryOrdersCount: 0 }
        }
        catch (exception) {
            throw exception;
        }
    }

    async getDashbordOrderGraphData({hubId, days, remark, status}) {
        try {
            if (!days)
                throw new Error("Please provide the number of days");

            const processedDays = this.calculateDays(days);
            const adjustedDays = processedDays === 0 ? processedDays : processedDays - 1;

            const hubIdsArr = (hubId ? hubId.split(',') : []).map(i => Number(i));
            if (!hubIdsArr.length) {
                return [{ orderCount: 0 }];
            }

            let dates =  this.enumerateDaysBetween(dayjs().subtract(adjustedDays, "days").format('YYYY-MM-DD 00:00:00'), dayjs().format('YYYY-MM-DD'));
            dates = dates.reverse();
            const orderReceivePickup = await dashboardModel.getDashbordOrderGraphData(hubIdsArr, adjustedDays, remark, status);
            const formatOrderObject = (obj) => {
                return {
                    orderCount: obj.orderCount || 0,
                    sellersCount: obj.sellersCount || 0,
                    dayCreated: dayjs(obj.dayCreated).format('DD MMM YYYY')
                };
            };
            const ordersPerDay = dates.map(i => {
                const index = orderReceivePickup.findIndex(e => dayjs(e.dayCreated).format('YYYY-MM-DD') === i);
                if (index > -1) {
                    return formatOrderObject(orderReceivePickup[index]);
                }
                return formatOrderObject({ dayCreated: i });
            });
            return ordersPerDay;
        } catch (exception) {
            throw exception;
        }
    }


    async getDistanceCovered(filters) {
        try {
            if (!filters?.days)
                throw new Error("Please provide no of days")

            let days = this.calculateDays(filters?.days);

            days = days == 0 ? days : days - 1

            filters.hubid = filters?.hubid.split(',');

            let dates = this.enumerateDaysBetween(dayjs().subtract(days, "days").format('YYYY-MM-DD 00:00:00'), dayjs().format('YYYY-MM-DD'));

            dates = dates.reverse();

            let distance_covered = await dashboardModel.getDistanceCovered(filters, days);

            const formatObject = (obj) => {
                return { distanceCovered: obj.distanceCovered || 0, dayCreated: dayjs(obj.dayCreated).format('DD MMM YYYY') }
            }

            let ordersPerDay = dates.map(i => {
                let index = distance_covered.findIndex(e => dayjs(e.dayCreated).format('YYYY-MM-DD') === i)
                if (index > -1) return formatObject(distance_covered[index])
                if (index > -1) return formatObject(distance_covered[index])
                return formatObject({ dayCreated: i })
            })
            return ordersPerDay
        }
        catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async getUnassignedTripCountDelivery(filters) {
        try {

            filters.hubid = filters?.hubid.split(',');

            const TOTAL_UNASSIGNED_TRIP_COUNT = await dashboardModel.getUnassignedTripCountDelivery(filters);

            return TOTAL_UNASSIGNED_TRIP_COUNT;

        }
        catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async getUnassignedTripCountPickup(filters) {
        try {

            filters.hubid = filters?.hubid.split(',');

            const TOTAL_UNASSIGNED_TRIP_COUNT = await dashboardModel.getUnassignedTripCountPickup(filters);

            return TOTAL_UNASSIGNED_TRIP_COUNT;

        }
        catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async getWorkingRiderCount(filters, user_id) {
        try {
            filters.hubid = filters?.hubid.split(',');

            const WORKING_RIDERS_COUNT = await dashboardModel.getWorkingRiderCount(filters, user_id);

            return WORKING_RIDERS_COUNT;

        }
        catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async getPickupCount(filters, hubid) {
        try {
            hubid = hubid.split(',')

            const ORDER_COUNT = await dashboardModel.getPickupCount(filters, hubid);

            return ORDER_COUNT;
        } catch (exception) {
            console.error(exception)
            throw new Error(exception.message || exception)
        }
    }

    async getUserWiseHubList(user_id, is_gateway = false) {
        try {
            const user_wise_hub_list = await getAllHubsByUser(user_id, is_gateway);

            return user_wise_hub_list;

        } catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    calculateDays(day) {
        if (day !== 'mtd' && day !== 'lifetime') return day
        if (day === 'mtd') return new Date().getUTCDate()
        if (day === 'lifetime') return 'lifetime'
    }

    enumerateDaysBetween(startDate, endDate) {
        let date = []
        while (dayjs(startDate) <= dayjs(endDate)) {
            date.push(endDate);
            endDate = dayjs(endDate).subtract(1, 'days').format("YYYY-MM-DD");
        }
        return date;
    }

    async getPendingPickupReq(filters, hubid) {
        try {
            hubid = hubid.split(',')
            if (!hubid?.length) {
                return [{ totalPendingPickupReq: 0, pending_order_count: 0 }]
            }
            const result = await dashboardModel.totalPendingPickupReq(filters, hubid);
            if (!result.length) return [{ totalPendingPickupReq: 0, pending_order_count: 0 }];
            return result;

        } catch (exception) {
            console.error(exception)
            throw new Error(exception.message || exception)
        }
    }

    async getfailedPickupReq(filters, hubid) {
        try {
            hubid = hubid.split(',')
            if (!hubid?.length) {
                return [{ toalFailedPickupReq: 0, failed_order_count: 0 }]
            }
            const result = await dashboardModel.getfailedPickupReq(filters, hubid);
            if (!result.length) return [{ toalFailedPickupReq: 0, failed_order_count: 0 }];
            return result;

        } catch (exception) {
            console.error(exception)
            throw new Error(exception.message || exception)
        }
    }


    async completedPickupReq(filters, hubIds) {
        try {
            // Convert hubIds to an array if it's not already an array
            hubIds = hubIds.split(',');

            // Initialize variables
            let completedPickupReqCount = 0;
            let completedOrderCount = 0;

            // If hubIds is empty, return the initialized variables
            if (!hubIds?.length) {
                return [{ completedPickupReqCount, completedOrderCount }];
            }

            // Get completed pickup request count for the given hubIds and filters
            const completedPickupRequests = await dashboardModel.getRouteRequestByPickupReq(filters, hubIds, 2);
            if (!completedPickupRequests?.length) {
                return [{ completedPickupReqCount, completedOrderCount }];
            }
            completedPickupReqCount = completedPickupRequests.length;

            // Get completed order count for the completed route request assigned ids
            completedPickupRequests.forEach(({ picked_order_count }) => {
                completedOrderCount += picked_order_count

            });

            return [{ completedPickupReqCount, completedOrderCount }];

        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception);
        }
    }


    async partialPickupReq(filters, hubIds) {
        try {
            hubIds = hubIds.split(',')
            // Initialize variables
            let partialPickupReqCount = 0;
            let partialPickupOrderCount = 0;

            if (!hubIds?.length) {
                return [{ partialPickupReqCount, partialPickupOrderCount, failedOrderCount : 0 }];
            }
            const startDate = dayjs(filters?.startDate || new Date()).format('YYYY-MM-DD 00:00:00');
            const endDate = dayjs(filters?.endDate || new Date()).format('YYYY-MM-DD 23:59:59');

            const partialPickupRequestsResult = await dashboardModel.getRouteRequestByPickupReq(filters, hubIds, 4);

            partialPickupReqCount = partialPickupRequestsResult.length;
            const routeReqAssignedId = []
            partialPickupRequestsResult.forEach(({ picked_order_count, route_request_assigned_id }) => {
                routeReqAssignedId.push(route_request_assigned_id)
                partialPickupOrderCount += picked_order_count

            });
            const failedOrdersResult = routeReqAssignedId.length ? await orderModel.getPickupRequestAndStatusWiseOrdersbyHubId([17], startDate, endDate, hubIds) : [];
            const failedOrderCount = failedOrdersResult.length ? failedOrdersResult[0].orderCount : 0;
            // const failedOrdersResult = routeReqAssignedId.length ? await orderModel.getPickupRequestAndStatusWiseOrders([17], startDate, endDate, routeReqAssignedId) : [];
            // const failedOrderCount = failedOrdersResult.length ? failedOrdersResult[0].orderCount : 0;

            return [{ partialPickupReqCount, partialPickupOrderCount, failedOrderCount }];
        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception);
        }
    }

    async getHubWiseOrders(days, user_id) {
        try {
            days = this.calculateDays(days);

            days = days == 0 ? days : days - 1

            const HUBIDS = await USER_MODEL.getHubsByUserId(user_id)

            if (!HUBIDS.length) {
                throw new Error("No hub is assigned to you")
            }

            const hubIds = HUBIDS.map(({ hub_id }) => hub_id)


            let HUBWISE_ORDERS_COUNT = await dashboardModel.getHubWiseOrders(days, hubIds);

            HUBWISE_ORDERS_COUNT = HUBWISE_ORDERS_COUNT.slice(0, 10)

            return HUBWISE_ORDERS_COUNT;

        }
        catch (exception) {
            throw exception
        }
    }
}



module.exports = Dashboard;
