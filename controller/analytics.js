"use strict";
const analyticsModel = require('../models/analytics')
const slots = [
    "10:00-12:00",
    "12:00-14:00",
    "14:00-16:00",
    "16:00-18:00",
    "18:00-20:00",
    "20:00-22:00"];
    
class Analytics {

    async getSlotwisePickupCount() {
        try {
            const currentDayOfWeek = new Date().getDay();
            const intervalDay = currentDayOfWeek === 1 ? 2 : 1;
            const slotWiseOrders = await analyticsModel.getSlotwisePickupCount(intervalDay);

            const { totalOrders, slotWiseOrdersObj } = slotWiseOrders.reduce((acc, { order_count, date, slot_hour }) => {
                const totalOrders = acc.totalOrders + order_count;
                const updatedSlotWiseOrdersObj = { ...acc.slotWiseOrdersObj, [slot_hour]: { order_count, date, slot_hour } };
                return { totalOrders, slotWiseOrdersObj: updatedSlotWiseOrdersObj };
            }, { totalOrders: 0, slotWiseOrdersObj: {} });

            return slots.reduce((acc, element) => {
                const { order_count = 0, slot_hour = element } = slotWiseOrdersObj[element] || {};
                const pickup_percent = (
                  totalOrders ? (order_count / totalOrders) * 100 : 0
                ).toFixed(2);
                const date = new Date();

                date.setDate(date.getDate() - intervalDay);

                acc.push({
                    order_count,
                    date,
                    slot_hour,
                    pickup_percent
                });

                return acc;
            }, [])

        } catch (error) {
            console.error(__line, error);
            throw error;
        }
    }


    async getAverageTimeTakenToPickup(hubId, pickupState) {
        try {
            if (!hubId) throw new Error('Please select hub.');
            const hubIds = hubId.split(',');
            if (!hubIds.length) throw new Error('Please select hub.');
            const averageTimeTaken = await analyticsModel.getAverageTimeTakenToPickup(hubIds, pickupState);

            return averageTimeTaken.reduce((acc, { sum_between_pickup, total_pickup_req, date }) => {
                const averageTimeInMinutes = sum_between_pickup / total_pickup_req;
                const hours = Math.floor(averageTimeInMinutes / 60);
                const minutes = Math.round(averageTimeInMinutes % 60);

                acc.push({
                    total_pickup_req,
                    date,
                    average_time_taken: `${hours} hours : ${minutes} minutes`
                });

                return acc;
            }, []);
        } catch (error) {
            console.error(__line, error);
            throw error;
        }
    }
}

module.exports = Analytics;