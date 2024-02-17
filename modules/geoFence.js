const { getHubsByUserId } = require('../models/users');
const { getSettingDataByName } = require('../models/appSetting');

const SETTING_NAME = {
  requireLocation: 'require_location_for_login',
  distanceRestriction: 'distance_restriction',
};

async function checkUserIsNearByHub(userId, userLat, userLng) {
  try {
    // Get hubs assigned to the user
    const userAssignedHubs = await getHubsByUserId(userId);
    // Extract hub IDs
    const userAssignedHubIds = userAssignedHubs.map(({ id }) => id);

    // Check location information
    const locationInfo = await checkLocationInfo(userAssignedHubIds, userId);

    if (!locationInfo) return true; // If no location info, return true

    if (locationInfo && !(userLat && userLng)) return false; // If location info exists but latitude or longitude is missing, return false

    // Get login geofence
    const loginGeoFence = await getLoginGeoFence(userAssignedHubIds, userId);

    if (loginGeoFence == null) return true;

    // Check hubs without latitude and longitude
    const noHubLatLng = userAssignedHubs.filter(
      ({ lat, lng }) => lat == null && lng == null,
    );
    if (noHubLatLng.length) {
      throw new Error(
        `Unable to find location details of hubs assigned to you. Please contact support.`,
      );
    }

    // Check distance between user's coordinates and assigned hub coordinates
    for (const { lat: hubLat, lng: hubLng } of userAssignedHubs) {
      const distanceBetweenCoordinates = calculateDistance(
        Number(userLat),
        Number(userLng),
        hubLat,
        hubLng,
      );
      if (distanceBetweenCoordinates <= loginGeoFence) {
        return true; // If user is near a hub, return true
      }
    }

    throw new Error(`Permission Denied. Login is allowed from hub location.`);
  } catch (exception) {
    console.error(exception);
    throw exception; // Rethrow the exception
  }
}

async function checkLocationInfo(userAssignedHubIds, userId) {
  // Get app setting by setting ID
  //7   Require Location for login
  const [appSetting] = await getSettingDataByName(
    SETTING_NAME.requireLocation,
  );
  // Extract location information from app setting
  const {
    status: locationStatus = 0,
    hub: { hub_id: hubList = [] } = {},
    user: { user_id: userList = [] } = {},
  } = appSetting || {};
  return (
    locationStatus &&
    (hubList.includes(0) ||
      userList.includes(0) ||
      hubList.some((value) => userAssignedHubIds.includes(value)) ||
      userList.includes(userId))
  ); // Return true if location information meets the conditions, otherwise false
}

async function getLoginGeoFence(userAssignedHubIds, userId) {
  // Get app setting by setting ID
  //8   Distance Restriction
  const [appSetting] = await getSettingDataByName(
    SETTING_NAME.distanceRestriction,
  );
  // Extract distance restriction information from app setting
  const {
    status: distanceRestrictionStatus = 0,
    value: { geo_fence: loginGeoFence = 0 } = {},
    hub: { hub_id: hubList = [] } = {},
    user: { user_id: userList = [] } = {},
  } = appSetting || {};
  //TODO we can use this as comman
  return distanceRestrictionStatus &&
    (hubList.includes(0) ||
      userList.includes(0) ||
      hubList.some((value) => userAssignedHubIds.includes(value)) ||
      userList.includes(userId))
    ? loginGeoFence
    : 0; // Return login geofence value if distance restriction is enabled, otherwise 0
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!(lat1 && lon1 && lat2 && lon2)) {
    return;
  }
  // Convert degrees to radians
  const lon1Rad = (lon1 * Math.PI) / 180; // Convert lon1 from degrees to radians
  const lon2Rad = (lon2 * Math.PI) / 180; // Convert lon2 from degrees to radians
  const lat1Rad = (lat1 * Math.PI) / 180; // Convert lat1 from degrees to radians
  const lat2Rad = (lat2 * Math.PI) / 180; // Convert lat2 from degrees to radians

  // Haversine formula
  const dlon = lon2Rad - lon1Rad; // Calculate the difference in longitude in radians
  const dlat = lat2Rad - lat1Rad; // Calculate the difference in latitude in radians
  const a =
    Math.pow(Math.sin(dlat / 2), 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.pow(Math.sin(dlon / 2), 2); // Calculate the intermediate value 'a' in the Haversine formula
  const c = 2 * Math.asin(Math.sqrt(a)); // Calculate the central angle 'c' using the intermediate value 'a'

  // Radius of the Earth in kilometers
  const earthRadiusKm = 6371; // Radius of the Earth in kilometers (assumed constant)

  // Calculate the result
  const distance = c * earthRadiusKm; // Calculate the distance using the Haversine formula and Earth's radius
  return distance * 1000; // Return the calculated distance in meter
}

module.exports = { calculateDistance, checkUserIsNearByHub };
