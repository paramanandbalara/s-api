'use strict';

const axios = require('axios');
const {
  google_maps: { BASE_URL, GEO_CODE, API_KEY, DISTANCE_MATRIX },
} = require('../../shyptrack-static/stconfig.json');
const { updateLatLongInDb } = require('../models/pickup_location');
const RESPONSE_TYPE = '/json';

async function getDistanceBetweenLatLng(origins, destinations) {
  try {
    origins = origins.join('|');
    destinations = destinations.join('|');

    const units = 'metric';
    const url = `${BASE_URL}${DISTANCE_MATRIX}${RESPONSE_TYPE}`;
    const queryParams = new URLSearchParams({
      units,
      origins,
      destinations,
      key: API_KEY,
    });
    const config = {
      method: 'get',
      url: `${url}?${queryParams.toString()}`,
      headers: {
        Accept: 'application/json',
      },
    };
    const { data } = await axios(config);
      return data;
   
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/**
 * Fetches latitude and longitude from the provided address and updates the corresponding entity's location in the database.
 * @param {string} address - The address for which to fetch latitude and longitude.
 * @param {string} entityType - The type of entity (pickupLocation or hubCreation).
 * @param {number} entityId - The ID of the entity in the database.
 */
async function getAndUpdateLatLng(address, entityType, entityId) {
  if (!address || !entityType || !entityId) {
    console.log(
      `None of these can undefined of blank ${{
        address,
        entityType,
        entityId,
      }}`,
    );
    return;
  }

  try {
    const url = `${BASE_URL}${GEO_CODE}${RESPONSE_TYPE}`;
    const queryParams = new URLSearchParams({
      address,
      key: API_KEY,
    });

    const config = {
      method: 'get',
      url: `${url}?${queryParams.toString()}`,
      headers: {
        Accept: 'application/json',
      },
    };
    const response = await axios(config);
    const {
      data: { results },
    } = response;
    const result = results.length ? results[0] : null;
    if (!result) {
      console.log('No results found for the given address.');
      return;
    }
    //location object look like this { lat, lng }
    const {
      geometry: { location },
    } = result;
    await updateEntityLatLongInDb(entityType, entityId, location);
  } catch (error) {
    console.error(error);
  }
}

/**
 * Updates the latitude and longitude of an entity in the database.
 * @param {string} entityType - The type of entity (pickupLocation or hubCreation).
 * @param {number} entityId - The ID of the entity in the database.
 * @param {object} location - The latitude and longitude coordinates.
 */
async function updateEntityLatLongInDb(entityType, entityId, { lat, lng }) {
  let tableName;
  switch (entityType) {
    case 'pickupLocation':
      tableName = 'pickup_location';
      break;
    case 'hubDetails':
      tableName = 'hub_details';
      break;
    default:
      return;
  }

  await updateLatLongInDb(entityId, tableName, { lat, lng });
}

module.exports = { getAndUpdateLatLng, getDistanceBetweenLatLng };
