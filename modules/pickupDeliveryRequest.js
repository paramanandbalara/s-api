const pickupRequestModel = require('../models/pickup_request');
const hubModel = require('../models/hub');
const moment = require('moment');
const { updateRouteRequest } = require('../models/routeAssignment');
const deliveryRequestModel = require('../models/orderDelivery');
const ordersModel = require('../models/orders');
const EventController = require('../controller/event');
const {
  MAX_AMOUNT_IN_PICKUP: maxOrderAmountInPickupReq = 0,
  SECURE_PICKUP_MODES: securePickupModes = [],
} = require('../../shyptrack-static/shypmax.json');
const {
  stop_failed_pickup: stopFailedPickupCount,
} = require('../../shyptrack-static/stconfig.json');
const CANCELLED_ORDER_BY_SELLER_STATUS = 20;
const RESCHEDULE_ORDER_STATUS = 21;

const updateOrderAndCreatePickupRequest = async ({
  ordersForEvent,
  pickupLocationId,
  pickupRequestNo,
  orderStatus,
  existingRouteRequestAssignedId,
  hubId,
}) => {
  try {
    const manifestClosedOnTime = moment().add(330, 'minutes').format('HH:mm');
    const {
      orderIdsToBeUpdate,
      currentOrderCount,
      failedOrders,
      cancelledOrders,
    } = ordersForEvent.reduce(
      (acc, cur) => {
        const { id, pickup_assigned_count: pickuAssignCount, mode } = cur;
        acc.orderIdsToBeUpdate.push(id);
        if (pickuAssignCount < stopFailedPickupCount) {
          acc.failedOrders.push(cur);
          acc.currentOrderCount += 1;
        } else if (mode === 'FBA Pro') {
          acc.failedOrders.push(cur);
        }else {
          acc.cancelledOrders.push(cur);
        }
        return acc;
      },
      {
        orderIdsToBeUpdate: [],
        currentOrderCount: 0,
        failedOrders: [],
        cancelledOrders: [],
      },
    );
    const {
      pickup_request_id: pickupReqId = null,
      route_request_assigned_id: routeRequestAssignedId = null,
    } = currentOrderCount
      ? await pickupRequest({
          currentOrderCount,
          manifestClosedOnTime,
          hubId,
          pickupLocationId,
          pickupNo: pickupRequestNo,
          nextDayPickup: true,
          mode: ordersForEvent[0].mode,
        })
      : {};

    await ordersModel.updateOrderWithFailedCounts({
      routeRequestAssignedId,
      pickup_request_id: pickupReqId,
      orderStatus: RESCHEDULE_ORDER_STATUS,
      orderIdsToBeUpdate,
      stopFailedPickupCount,
    });

    if (failedOrders.length) {
      createEventObjAndEvent({
        status: orderStatus,
        orders: failedOrders,
        route_request_assigned_id: existingRouteRequestAssignedId,
      });

      createEventObjAndEvent({
        status: RESCHEDULE_ORDER_STATUS,
        orders: failedOrders,
        route_request_assigned_id: existingRouteRequestAssignedId,
      });
    }

    if (cancelledOrders.length) {
      createEventObjAndEvent({
        status: CANCELLED_ORDER_BY_SELLER_STATUS,
        orders: cancelledOrders,
      });
    }

    if (routeRequestAssignedId) {
      createEventObjAndEvent({
        status: 3, //for rider assigned
        orders: failedOrders,
      });
    }

    return pickupReqId;
  } catch (exception) {
    console.error(exception);
    throw exception;
  }
};

const createEventObjAndEvent = ({
  status,
  orders,
  route_request_assigned_id = null,
}) => {
  const eventController = new EventController();
  eventController.createEvent({
    status,
    orders,
    route_request_assigned_id,
  });
};

const pickupRequest = async (data) => {
  try {
    const {
      currentOrderCount,
      manifestClosedOnTime = null,
      hubId,
      hub_cutoff_time: hubCutoffTime = null,
      pickupLocationId,
      pickup_no: pickupNo = null,
      nextDayPickup = false,
      mode,
      packageValue = 0,
    } = data;
    const securePickup = securePickupModes.includes(mode) ? 1 : 0;

    const [pickupRequestDetails] = pickupNo
      ? await pickupRequestModel.getOpenPickupReqByPickupLocationExceptCurrent(
          pickupLocationId,
          pickupNo,
          hubId,
          securePickup,
        )
      : await pickupRequestModel.getPickupRequestData(
          pickupLocationId,
          hubId,
          securePickup,
        );
    let pickupRequestId;
    let riderAssignedToPickupRequest = false;
    let routeRequestAssignedId = null;

    if (pickupRequestDetails) {
      const {
        id,
        state: pickupRequestState,
        manifested_orders_count: manifestedOrdersCount,
        pending_order_count: pendingOrderCount,
        secured_pickup: securedPickup,
      } = pickupRequestDetails;

      pickupRequestId = id;

      if (securedPickup) {
        const [sumOfOrders] = await pickupRequestModel.sumOfOrdersInPickup(
          pickupRequestId,
        );
        const { totalOrderAmt = 0 } = sumOfOrders;
        if (
          Number(packageValue) + Number(totalOrderAmt) >=
          maxOrderAmountInPickupReq
        ) {
          pickupRequestId = await createNewPickupRequest({
            hubCutoffTime,
            manifestClosedOnTime,
            nextDayPickup,
            pickupLocationId,
            currentOrderCount,
            hubId,
            securePickup,
          });
          return {
            pickup_request_id: pickupRequestId,
            riderAssignedToPickupRequest,
            route_request_assigned_id: routeRequestAssignedId,
          };
        }
      }

      if (pickupRequestState !== 1) {
        riderAssignedToPickupRequest = true;
      }

      const updatedManifestedOrdersCount =
        Number(currentOrderCount) + Number(manifestedOrdersCount);
      const updatedPendingOrdersCount =
        Number(currentOrderCount) + Number(pendingOrderCount);

      await pickupRequestModel.updatePickupRequest(
        {
          manifested_orders_count: updatedManifestedOrdersCount,
          pending_order_count: updatedPendingOrdersCount,
        },
        pickupRequestId,
      );

      routeRequestAssignedId = await updateRouteRequestWithAssignedCount(
        pickupRequestId,
        updatedManifestedOrdersCount,
      );
    } else {
      pickupRequestId = await createNewPickupRequest({
        hubCutoffTime,
        manifestClosedOnTime,
        nextDayPickup,
        pickupLocationId,
        currentOrderCount,
        hubId,
        securePickup,
      });
    }

    return {
      pickup_request_id: pickupRequestId,
      riderAssignedToPickupRequest,
      route_request_assigned_id: routeRequestAssignedId,
    };
  } catch (error) {
    console.error(__line, error);
    throw error;
  }
};

// Function to calculate pickup date based on hub cutoff time, manifest closed time, and pickup type
const calculatePickupDate = (
  hubCutoffDateTime,
  manifestClosedOnDateTime,
  nextDayPickup,
) => {
  // Get current time
  const currentTime = moment().add(330, 'minutes');
  // Convert hub cutoff time to moment object
  const hubCutoffTime = moment(hubCutoffDateTime, 'HH:mm:ss');
  // Convert manifest closed time to moment object
  const manifestClosedOnTime = moment(manifestClosedOnDateTime, 'HH:mm:ss');
  // Check if pickup can be scheduled on the same day
  const isSameDayPickup =
    manifestClosedOnTime <= hubCutoffTime && currentTime.day() !== 0;
  // Check if pickup should be scheduled on the next day
  const isNextDayPickup =
    !isSameDayPickup || nextDayPickup || currentTime.day() === 6;
  // Return the pickup date based on the pickup type
  return isNextDayPickup ? currentTime.add(1, 'day') : currentTime;
};

const createNewPickupRequest = async ({
  hubId,
  hubCutoffTime,
  manifestClosedOnTime,
  nextDayPickup,
  pickupLocationId,
  currentOrderCount,
  securePickup,
}) => {
  try {
    if (!hubCutoffTime) {
      const hubDetails = await hubModel.getHubDetailsById(hubId);
      hubCutoffTime = hubDetails.cutoff_time;
    }

    const pickupDate = calculatePickupDate(
      hubCutoffTime,
      manifestClosedOnTime,
      nextDayPickup,
    );
    const pickupReqNumber = await generateUniqueRequestNumber(
      pickupRequestModel.checkIfPickupReqNumExist,
    );

    const pickupReqData = {
      pickup_request_no: pickupReqNumber,
      pickup_date: pickupDate.format('YYYY-MM-DD'),
      status_date: new Date(),
      pickup_location_id: pickupLocationId,
      manifested_orders_count: currentOrderCount,
      pending_order_count: currentOrderCount,
      hub_id: hubId,
      state: 1, // 1: Open, 2: Success, 3: Failed
      secured_pickup: securePickup,
    };

    const pickupRequestResult = await pickupRequestModel.insertPickupRequest(
      pickupReqData,
    );

    if (!pickupRequestResult?.insertId) {
      throw Error('Failed to insert pickup request. Please contact support!');
    }

    return pickupRequestResult.insertId;
  } catch (error) {
    console.error(__line, error);
    throw error;
  }
};

const updateRouteRequestWithAssignedCount = async (
  pickup_request_id,
  currentOrderCount,
) => {
  try {
    const route_request_assigned_Details =
      await pickupRequestModel.openPickupTripsByPickupReq(pickup_request_id);

    if (route_request_assigned_Details.length) {
      const pickup_trip = route_request_assigned_Details[0];

      let { id } = pickup_trip;

      await updateRouteRequest({ assigned_order_count: currentOrderCount }, id);

      return id;
    }
    return null;
  } catch (error) {
    console.error(__line, error);
    throw Error(error);
  }
};

const createDeliveryRequest = async (data) => {
  let {
    delivery_location_id,
    hub_id,
    cutoff_time: hub_cutoff_time = null,
    order_count,
    delivery_request_no = false,
  } = data;
  hub_cutoff_time = null;
  try {
    let delivery_date = moment().add(330, 'minutes').format('YYYY-MM-DD');
    let delivery_req_id;
    let rider_assigne_to_delivery_req = false;
    let route_request_assigned_id = null;

    let DELIVERY_REQUEST_DETAILS;

    if (delivery_request_no) {
      DELIVERY_REQUEST_DETAILS =
        await deliveryRequestModel.getOpenDeliveryRequestLocationExceptCurrent(
          delivery_location_id,
          delivery_request_no,
          hub_id,
        );
    } else {
      DELIVERY_REQUEST_DETAILS = await deliveryRequestModel.getDeliveryRequest(
        delivery_location_id,
        hub_id,
      );
    }
    if (DELIVERY_REQUEST_DETAILS.length) {
      const {
        id,
        orders_count,
        pending_order_count,
        state: delivery_req_state,
      } = DELIVERY_REQUEST_DETAILS[0];
      if (delivery_req_state != 1) rider_assigne_to_delivery_req = true;
      delivery_req_id = id;

      const update_delivery_req_obj = {
        orders_count: Number(orders_count) + Number(order_count),
        pending_order_count: Number(pending_order_count) + Number(order_count),
      };
      await deliveryRequestModel.updateDeliveryReq(
        delivery_req_id,
        update_delivery_req_obj,
      );
      route_request_assigned_id =
        await updateRouteRequestWithAssignedCountDelivery(
          delivery_req_id,
          order_count,
        );
    } else {
      if (!hub_cutoff_time) {
        const hub_details = await hubModel.getHubDetailsById(hub_id);
        const { cutoff_time } = hub_details;
        hub_cutoff_time = cutoff_time;
      }
      let current_time = moment().add(330, 'minutes').format('HH:mm');
      const day = moment().add(330, 'minutes').day();
      const date1 = new Date('2023-01-01 ' + current_time);
      const date2 = new Date('2023-01-01 ' + hub_cutoff_time);

      const condition1 = date1.getTime() === date2.getTime();
      const condition2 = date1.getTime() < date2.getTime();
      const condition3 = day != 0; //0 ->sunday, 6->saturday

      if ((condition1 || condition2) && condition3) {
        //less than equal to cutoff time consider SAME DAY Delivery else NEXT DAY (next day should not be sunday)
        delivery_date = moment().add(330, 'minutes').format('YYYY-MM-DD');
      } else {
        //NEXT DAY Delivery
        delivery_date = moment()
          .add(330, 'minutes')
          .add(1, 'days')
          .format('YYYY-MM-DD');
        if (day == 6)
          delivery_date = moment()
            .add(330, 'minutes')
            .add(2, 'days')
            .format('YYYY-MM-DD');
      }

      // Declare a variable to store the delivery request number
      const delivery_request_number = await generateUniqueRequestNumber(
        pickupRequestModel.checkIfPickupReqNumExist,
      );

      const delivery_req_data = {
        delivery_request_no: delivery_request_number, //or String(+new Date()).slice(0.-5)
        delivery_date: delivery_date,
        status_date: new Date(),
        delivery_location_id: delivery_location_id,
        orders_count: order_count,
        pending_order_count: order_count,
        hub_id: hub_id,
        state: 1, //1:Open, 2:Succcess, 3:Failed
      };
      const DELIVERY_REQUEST_RESULT =
        await deliveryRequestModel.insertDeliveryRequest(delivery_req_data);

      if (!DELIVERY_REQUEST_RESULT?.insertId)
        throw Error(
          `Failed to insert delivery request.Please contact support !`,
        );
      delivery_req_id = DELIVERY_REQUEST_RESULT.insertId;
    }

    return {
      delivery_req_id,
      route_request_assigned_id,
      rider_assigne_to_delivery_req,
    };
  } catch (exception) {
    console.error(exception);
    throw new Error(exception.message || exception);
  }
};

const updateRouteRequestWithAssignedCountDelivery = async (
  delivery_req_id,
  currentOrderCount,
) => {
  try {
    const route_request_assigned_Details =
      await deliveryRequestModel.openPickupTripsByDeliveryReq(delivery_req_id);

    if (route_request_assigned_Details.length) {
      const delivery_trip = route_request_assigned_Details[0];

      let { assigned_order_count, id } = delivery_trip;

      assigned_order_count += Number(currentOrderCount);

      await updateRouteRequest({ assigned_order_count }, id);

      return id;
    }
    return null;
  } catch (exception) {
    console.error(exception);
    throw new Error(exception.message || exception);
  }
};
/**
 * Generates a unique six-digit request number for pickup or delivery.
 * @param {Function} checkReqNumberInDb - A function that checks whether the generated request number already exists in the database.
 * @returns {Promise<number>} - A Promise that resolves to the generated request number.
 */
const generateUniqueRequestNumber = async (checkReqNumberInDb) => {
  try {
    // Validate that checkReqNumberInDb is a function.
    if (typeof checkReqNumberInDb !== 'function') {
      throw new Error('checkReqNumberInDb must be a function.');
    }

    let requestNumber; // Declare a variable to store the request number.

    // Declare a variable to store the result of the database query for the generated request number.
    let checkRequestNumberExist = [];

    // Use a do-while loop to ensure that the generated request number is unique.
    do {
      // Generate a six-digit random number.
      requestNumber = Math.floor(100000 + Math.random() * 900000);

      // Check if the request number already exists in the database.
      checkRequestNumberExist = await checkReqNumberInDb(requestNumber);
    } while (checkRequestNumberExist.length); // Continue looping until a unique number is found.

    // At this point, requestNumber contains a unique six-digit number that can be used as a request number.
    return requestNumber;
  } catch (exception) {
    // Handle the exception here.
    console.error('Error generating unique request number:', exception);
    throw exception;
  }
};

module.exports = {
  pickup_request: pickupRequest,
  createDeliveryRequest,
  updateOrderAndCreatePickupRequest,
};
