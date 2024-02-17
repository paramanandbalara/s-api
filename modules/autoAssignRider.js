'use strict';

const {
  getOpenPickupRequestByPincodesOrAll,
  saveAutoAssignLog,
  getOpenPickupRequestByPincodesOrAllOutSideZone
} = require('../models/pickup_request');
const { getHubWiseRiderList } = require('../models/hub');

const {
  getZoneDetailsByHubId,
  getRiderByZone,
  getRiderOutsideZone
} = require('../models/autoAssign');
const { calculateDistance } = require('../modules/geoFence');
const { getDistanceBetweenLatLng } = require('../modules/locationService');
const PickupRequestController = require('../controller/pickup_request');

const ROUTE_METHOD_SETTING_NAME = 'auto_assignment_route_method';
const ROUTE_METHOD_GOOGLE_MAP = 'googleMap';

async function assignRiderZoneWise(
  hubDetails,
  autoAssignSettingDetails,
  selectedPickupReqList
) {
  try {
    //once auto assign method integrated then we will separate here by closest location or shortest route
    await assignRiderByModeClosestLocationAndZoneWise(
      hubDetails,
      autoAssignSettingDetails,
      selectedPickupReqList
    );
    //assign rider by shortestRoute new method shoud be call from here
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function assignRiderByModeClosestLocationAndZoneWise(
  hubDetails,
  autoAssignSettingDetails,
  selectedPickupReqList
) {
  try {
    const { id: hubId } = hubDetails;
    const zoneDetails = await getZoneDetailsByHubId(hubId);
    await Promise.all(
      zoneDetails.map((zone) =>
        autoAssignRiderAccordingZone(
          zone,
          hubDetails,
          autoAssignSettingDetails,
          selectedPickupReqList
        )
      )
    );
    await autoAssignRiderNonDefinedZoneArea(
      zoneDetails,
      hubDetails,
      autoAssignSettingDetails,
      selectedPickupReqList
    );
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function autoAssignRiderNonDefinedZoneArea(
  zoneDetails,
  hubDetails,
  autoAssignSettingDetails,
  selectedPickupReqList
) {
  try {
    const { id: hubId } = hubDetails;

    const routeMethod = getRouteMethod(autoAssignSettingDetails);
    const { zonePincodes, zoneIds } = zoneDetails.reduce(
      (acc, { id: zoneId, pincodes }) => {
        acc.zonePincodes.push(pincodes);
        acc.zoneIds.push(zoneId);
        return acc;
      },
      { zonePincodes: [], zoneIds: [] }
    );
    const pincodes = zonePincodes.join(',').split(',').map(Number);

   const selectedOutsideZonePickupReq = selectedPickupReqList.filter(
     (pickupReq) => {
       const { pincode } = pickupReq;
       return !pincodes.includes(pincode);
     }
   );

   const pickupRequestOutSideZone =
     zonePincodes.length &&
     selectedPickupReqList.length &&
     selectedOutsideZonePickupReq.length
       ? selectedOutsideZonePickupReq
       : zonePincodes.length
       ? await getOpenPickupRequestByPincodesOrAllOutSideZone(hubId, pincodes)
       : [];

    const riderOutSideZone = zoneIds.length
      ? await getRiderOutsideZone(hubId, zoneIds)
      : [];
    const data = {
      hubDetails,
      pickupReqList: pickupRequestOutSideZone,
      activeRiderList: riderOutSideZone,
      isZone: false
    };
    const riderPickupDistance =
      routeMethod === ROUTE_METHOD_GOOGLE_MAP
        ? await mapRidersGoogleMap(data)
        : mapRidersCustomJs(data);
    await assignRiderAndCreateRouteReq(riderPickupDistance);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function autoAssignRiderAccordingZone(
  zone,
  hubDetails,
  autoAssignSettingDetails,
  selectedPickupReqList
) {
  try {
    const { pincodes, id: zoneId } = zone;
    const { id: hubId } = hubDetails;
    const zonePincodes = pincodes ? pincodes.split(',').map(Number) : [];

    const zoneWiseRider = await getRiderByZone(zoneId);

    const selectedZonePickupReq = selectedPickupReqList.filter(
        (pickupReq) => {
          const { pincode } = pickupReq;
          return pincodes.includes(pincode);
        }
      );

    const pickupReqList = selectedPickupReqList.length
      ? selectedZonePickupReq
      : await getOpenPickupRequestByPincodesOrAll(hubId, zonePincodes);

    const routeMethod = getRouteMethod(autoAssignSettingDetails);

    const data = {
      hubDetails,
      pickupReqList,
      activeRiderList: zoneWiseRider,
      isZone: true
    };
    const riderPickupDistance =
      routeMethod === ROUTE_METHOD_GOOGLE_MAP
        ? await mapRidersGoogleMap(data)
        : mapRidersCustomJs(data);
    await assignRiderAndCreateRouteReq(riderPickupDistance);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function assignRiderWithoutZone(
  hubDetails,
  autoAssignSettingDetails,
  selectedPickupReqList
) {
  try {
    await assignRiderByModeClosestLocationAndWithoutZoneWise(
      hubDetails,
      autoAssignSettingDetails,
      selectedPickupReqList
    );
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function autoAssignRider(
  hubDetails,
  zoneDetails,
  autoAssignSettingDetails,
  selectedPickupReqList = []
) {
  try {
    const { status: zoneStatus = 0, hub } = zoneDetails || {};

    const { hub_id: hubList = [] } = hub || {};
    const { id: hubId } = hubDetails;
    zoneStatus === 1 && (hubList.includes(hubId) || hubList.includes(0))
      ? await assignRiderZoneWise(
          hubDetails,
          autoAssignSettingDetails,
          selectedPickupReqList
        )
      : await assignRiderWithoutZone(
          hubDetails,
          autoAssignSettingDetails,
          selectedPickupReqList
        );
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function assignRiderAndCreateRouteReq(riderPickupDistance) {
  try {
    for (const {
      pickupReq: {
        id: pickupReqId,
        lat: destinationLat,
        lng: destinationLng,
        address,
        pincode,
        pickup_request_no
      },
      rider: { id: riderId },
      distance,
      riderCurrentLat = null,
      riderCurrentLng = null,
      isZone,
      hubId,
      currentAddress = null,
      sequence
    } of riderPickupDistance) {
      await saveAutoAssignLog({
        rider_id: riderId,
        pickup_request_id: pickupReqId,
        current_location: `${riderCurrentLat}, ${riderCurrentLng}`,
        destination_location: `${destinationLat}, ${destinationLng}`,
        distance: distance / 1000,
        zone: isZone,
        hub_id: hubId,
        current_address: currentAddress,
        destination_address: `${address} - ${pincode}`,
        pickup_request_no,
        sequence
      });
    }
    // TODO currently just store Data in log table
    const pickupRequestController = new PickupRequestController();
    await Promise.allSettled(
      riderPickupDistance.map(
        ({
          pickupReq: {
            id,
            pending_order_count,
            secured_pickup,
            pickup_request_no,
            state,
          },
          rider: { id: riderId },
        }) =>
          pickupRequestController.processPickupRequest(
            {
              id,
              pending_order_count,
              secured_pickup,
              pickup_request_no,
              state,
            },
            riderId,
            0,
          ),
      ),
    );
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function assignRiderByModeClosestLocationAndWithoutZoneWise(
  hubDetails,
  autoAssignSettingDetails,
  selectedPickupReqList
) {
  const routeMethod = getRouteMethod(autoAssignSettingDetails);

  try {
    const { id: hubId } = hubDetails;
    const pickupReqList = selectedPickupReqList.length
      ? selectedPickupReqList
      : await getOpenPickupRequestByPincodesOrAll(hubId);
    const activeRiderList = await getHubWiseRiderList([hubId]);
    const data = {
      hubDetails,
      pickupReqList,
      activeRiderList
    };
    const riderPickupDistance =
      routeMethod === ROUTE_METHOD_GOOGLE_MAP
        ? await mapRidersGoogleMap(data)
        : mapRidersCustomJs(data);
    await assignRiderAndCreateRouteReq(riderPickupDistance);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

function mapRidersCustomJs({
  hubDetails,
  pickupReqList,
  activeRiderList,
  isZone = false
}) {
  const assignedPickupRequests = [];
  const {
    lat: hubLat,
    lng: hubLng,
    id: hubId,
    address: hubAddress,
    pincode: hubPincode
  } = hubDetails;

  pickupReqList.forEach((pickupReq) => {
    const {
      lat: pickupReqlat,
      lng: pickupReqlng,
      address: warehouseAddr,
      pincode: warehousePincode
    } = pickupReq;
    let perviousLat = null;
    let perviousLng = null;
    let pervAddress = null;
    let nearestRider = null;
    let minDistance = Infinity;
    let riderCurrentLat = null;
    let riderCurrentLng = null;
    let riderCurrentAddr = null;

    activeRiderList.forEach((rider) => {
      let {
        riderCurrentLat: riderLat,
        riderCurrentLng: riderLng,
        currentAddress
      } = rider;

      const distance = calculateDistance(
        riderLat || hubLat,
        riderLng || hubLng,
        pickupReqlat,
        pickupReqlng
      );
      console.log({ distance });
      if (distance < minDistance) {
        perviousLat = riderLat || hubLat;
        perviousLng = riderLng || hubLng;
        pervAddress = currentAddress || `${hubAddress} - ${hubPincode}`;
        nearestRider = rider;
        minDistance = distance;
      }
      riderCurrentLat = pickupReqlat;
      riderCurrentLng = pickupReqlng;
      riderCurrentAddr = `${warehouseAddr} - ${warehousePincode}`;
    });

    if (nearestRider) {
      console.log('Minimum distance to rider -> ', minDistance);
      nearestRider.riderCurrentLat = riderCurrentLat;
      nearestRider.riderCurrentLng = riderCurrentLng;
      nearestRider.currentAddress = riderCurrentAddr;
      nearestRider.sequence = (nearestRider.sequence || 0) + 1;

      assignedPickupRequests.push({
        pickupReq,
        rider: nearestRider,
        distance: minDistance,
        riderCurrentLat: perviousLat,
        riderCurrentLng: perviousLng,
        currentAddress: pervAddress,
        isZone,
        hubId,
        sequence: nearestRider.sequence
      });
      perviousLat = null;
      perviousLng = null;
    }
  });
  return assignedPickupRequests;
}

async function mapRidersGoogleMap({
  hubDetails,
  pickupReqList,
  activeRiderList,
  isZone = false
}) {
  const assignedPickupRequests = [];
  const { lat: hubLat, lng: hubLng, id: hubId } = hubDetails;

  for (const pickupReq of pickupReqList) {
    const { lat: pickupReqlat, lng: pickupReqlng } = pickupReq;
    const origins = activeRiderList.map((rider) => [
      rider.riderCurrentLat || hubLat,
      rider.riderCurrentLng || hubLng
    ]);
    const destinations = Array(activeRiderList.length).fill([
      pickupReqlat,
      pickupReqlng
    ]);

    try {
      const distanceBetweenLatLong = await getDistanceBetweenLatLng(
        origins,
        destinations
      );
      const { rows } = distanceBetweenLatLong;
      let minDistance = Infinity;
      let nearestRiderIndex = -1;

      rows.forEach((row, index) => {
        const { elements = [] } = row;
        const [element] = elements;
        const { distance: { value: calcDistance = Infinity } = {} } =
          element || {};
        if (calcDistance < minDistance) {
          nearestRiderIndex = index;
          minDistance = calcDistance;
        }
      });

      if (nearestRiderIndex !== -1) {
        const nearestRider = activeRiderList[nearestRiderIndex];
        nearestRider.riderCurrentLat = pickupReqlat;
        nearestRider.riderCurrentLng = pickupReqlng;
        nearestRider.sequence = (nearestRider.sequence || 0) + 1;

        assignedPickupRequests.push({
          pickupReq,
          rider: nearestRider,
          distance: minDistance,
          isZone,
          hubId,
          sequence: nearestRider.sequence
        });
      }
    } catch (error) {
      console.error('Error while calculating distance:', error);
    }
  }

  return assignedPickupRequests;
}

function getRouteMethod(autoAssignSettingDetails) {
  const routeMethodSetting = autoAssignSettingDetails.find(
    ({ setting_name }) => setting_name === ROUTE_METHOD_SETTING_NAME
  );

  const { value: { route_method: routeMethod } = {} } =
    routeMethodSetting || {};
  console.log({ routeMethod });
  return routeMethod;
}

module.exports = { autoAssignRider };
