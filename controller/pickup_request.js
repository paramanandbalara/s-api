'use strict';

const pickupRequestModel = require('../models/pickup_request');
const ordersModel = require('../models/orders');
const EventController = require('./event')
const eventController = new EventController();
const routeAssignmentModel = require('../models/routeAssignment');
const { getHubIdByUser } = require('../modules/userHub')
const UtilController = require('./util')
const utilController = new UtilController()
const userModel = require('../models/users')
const { SECURED_PICKUP_MAX_VALUE = 0 } = require('../../shyptrack-static/shypmax.json')
class PickupRequest {
  static DEFAULT_PAGE = 1;
  static DEFAULT_LIMIT = 25;

  async assignRider(pickup_request_no, rider_id, user_id) {
    if (!pickup_request_no?.length) {
      throw new Error('Pickup req number not found');
    }
    try {
      const { hub_id } = await getHubIdByUser(rider_id);
      await this.checkExistingRider(pickup_request_no, hub_id);

      const pickupRequestData = await routeAssignmentModel.getAllPickupRequests(
        pickup_request_no,
      );
      await Promise.all(
        pickupRequestData.map((item) =>
          this.processPickupRequest(item, rider_id, user_id),
        ),
      );

      return true;
    } catch (exception) {
      console.error(exception);
      throw exception;
    }
  }

  async checkExistingRider(pickup_request_no, hub_id) {
    await utilController.checkExistingRider(pickup_request_no, hub_id, '');
  }

  async processPickupRequest(item, rider_id, user_id) {
    const {
      id: pickupRequestId,
      pending_order_count: assignedOrderCount,
      secured_pickup: securedPickup,
      pickup_request_no: pickupRequestNum,
    } = item;

    if (securedPickup) {
      await this.checkSecuredPickupConditions(
        rider_id,
        pickupRequestNum,
        pickupRequestId,
      );
    }
    const eligibleStatusForAssign = [1, 3, 17, 16, 4, 21];
    const assignOrderStatus = 3;

    const orders = await ordersModel.getOrdersByPickupRequestIdAndStatus(
      pickupRequestId,
      eligibleStatusForAssign,
    );

    if (orders.length && [1, 5, 3].includes(item.state)) {
      const routeRequestAssignedDetails =
        await pickupRequestModel.openPickupTripsByPickupReq(pickupRequestId);

      if (routeRequestAssignedDetails.length) {
        const { id: routeRequestId, picked_order_count: pickedOrderCount } =
          routeRequestAssignedDetails[0];

        if (pickedOrderCount) {
          throw new Error(
            `You can't assign/re-assign, as already assigned rider has reached at location or pickup scan in-progress`,
          );
        }

        await routeAssignmentModel.updateRouteRequest(
          { rider_id },
          routeRequestId,
        );
        await pickupRequestModel.updatePickupRequest(
          { state: 5, rider_assigned_by: user_id },
          pickupRequestId,
        );
        return;
      }

      const pickupTripData = {
        pickup_request_id: pickupRequestId,
        assigned_order_count: assignedOrderCount,
        rider_id,
        status: 0,
        type: 1, // 1 for pickup
      };

      const routeRequestAssigned = await routeAssignmentModel.savePickupTrips(
        pickupTripData,
      );
      const routeRequestId = routeRequestAssigned.insertId;
      const orderIds = orders.map((ele) => ele.id);

      await ordersModel.updateOrderDetails(orderIds, {
        status: assignOrderStatus,
        route_request_assigned_id: routeRequestId,
      });
      await pickupRequestModel.updatePickupRequest(
        { state: 5, rider_assigned_by: user_id },
        pickupRequestId,
      );

      const eventObj = {
        status: assignOrderStatus,
        orders,
        route_request_assigned_id: routeRequestId,
      };

      await eventController.createEvent(eventObj);
    } else {
      throw new Error(
        `You can't assign rider to pickup request ${pickupRequestNum} as orders are already moved further.`,
      );
    }
  }

  /**
   * Checks the conditions for a rider to handle a secured pickup request.
   * @param {string} riderId - The ID of the rider.
   * @param {string} pickupRequestNum - The number of the pickup request.
   * @param {string} pickupRequestId - The ID of the pickup request.
   * @throws {Error} If the rider is not allowed to handle secured pickups or the total amount of secured packages exceeds the maximum allowed amount.
   */
  async checkSecuredPickupConditions(
    riderId,
    pickupRequestNum,
    pickupRequestId,
  ) {
    try {
      const errorMessage = `This rider is not allowed to handle high value / jewellery packages, pickup request ${pickupRequestNum}`;
      // Check if rider is allowed to handle secured packages
      const { secure_package } = await userModel.getUserDetailsById(riderId);
      if (!secure_package) {
        throw new Error(errorMessage);
      }

      // Check if total amount of secured packages exceeds the maximum allowed amount
      const [assignedTotalAmountOfSecuredPackages] =
        await ordersModel.getTotalAmountOfAssignedPickup(riderId, [1]);
      const { totalAmt: totalAmountInSelectedPr } =
        assignedTotalAmountOfSecuredPackages;
      if (totalAmountInSelectedPr) {
        const [sumOfOrders] = await pickupRequestModel.sumOfOrdersInPickup(
          pickupRequestId,
        );
        const { totalOrderAmt: totalOrderAmountInAssignedPr = 0 } = sumOfOrders;
        const totalAmountOfSecuredPackages =
          Number(totalAmountInSelectedPr) +
          Number(totalOrderAmountInAssignedPr);
        if (totalAmountOfSecuredPackages > Number(SECURED_PICKUP_MAX_VALUE)) {
          throw new Error(errorMessage);
        }
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}

module.exports = PickupRequest;