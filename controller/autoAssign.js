'use strict';
const AUTO_ROUTE_ASSIGNMENT_SETTING_NAME = 'auto_route_assignment';
const ZONE_WISE_SETTING_NAME = 'zone_wise_route_assignment';
const autoAssignModel = require('../models/autoAssign');
const {
  camelToSnakeCase,
  snakeToCamelCase
} = require('../modules/convertCase');
const { getHubsByUserId } = require('../models/users');
const {
  getPickupReqForAutoAssignByPickupReqNo
} = require('../models/pickup_request');
const { autoAssignRider } = require('../modules/autoAssignRider');
class AutoAssign {
  async getAutoAssignDetails(autoAssignName) {
    try {
      const settingDetails = await autoAssignModel.getAutoAssignDetails();
      const result = {};

      for (const setting of settingDetails) {
        const {
          setting_name: settingName,
          hub = {},
          status,
          value = {}
        } = setting;

        const { hub_id: hubList = [] } = hub || {};

        if (autoAssignName === AUTO_ROUTE_ASSIGNMENT_SETTING_NAME) {
          if (settingName === AUTO_ROUTE_ASSIGNMENT_SETTING_NAME) {
            result.status = status;
            result.hubList = hubList;
          }
          for (const key in value) {
            const val = value[key];
            result[snakeToCamelCase(key)] = val;
          }
        }

        if (
          autoAssignName === ZONE_WISE_SETTING_NAME &&
          settingName === ZONE_WISE_SETTING_NAME
        ) {
          result.status = status;
          result.hubList = hubList;
        }
      }

      return { ...result, autoAssignName };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async updateAutoAssignDetails({ settingName, status, hubsList }) {
    try {
      const updateData = {
        setting_name: camelToSnakeCase(settingName),
        // Only add 'status' key if status is provided
        ...(status != undefined && { status: status }),
        // Only add 'hub' key if hubsList is provided
        ...(hubsList &&
          hubsList.length && {
            hub: JSON.stringify({ hub_id: hubsList })
          }),
        value: '{}'
      };
      await autoAssignModel.updateAutoAssignDetails(updateData);
    } catch (error) {
      throw error;
    }
  }

  async updateOtherSettings(settingName, obj) {
    const value = {};
    let status = false;

    for (const [key, element] of Object.entries(obj)) {
      value[camelToSnakeCase(key)] = element;
      status = status || Boolean(element);
    }

    const updateData = {
      setting_name: camelToSnakeCase(settingName),
      value: JSON.stringify(value),
      status,
      hub: '{}'
    };

    await autoAssignModel.updateAutoAssignDetails(updateData);
  }

  async checkIsAutoAssignEnabled(userId) {
    try {
      const [autoRouteAssignmentDetails] =
        await autoAssignModel.getAutoAssignDetailsByName(
          'auto_route_assignment'
        );
      const { status: isAutoRouteAssignmentEnabled = 0, hub = {} } =
        autoRouteAssignmentDetails || {};
      const { hub_id: autoRouteEnabledHubList = [] } = hub || {};
      const userHubs =
        isAutoRouteAssignmentEnabled && autoRouteEnabledHubList.length
          ? await getHubsByUserId(userId)
          : [];

      const userHubIds = userHubs.map(({ hub_id }) => hub_id);
      return (
        isAutoRouteAssignmentEnabled &&
        (autoRouteEnabledHubList.includes(0) ||
          autoRouteEnabledHubList.some((value) => userHubIds.includes(value)))
      );
    } catch (error) {
      throw error;
    }
  }

  async autoAssignRider(userId, selectedPickupReqNo) {
    try {
      const [autoRouteAssignmentDetails] =
        await autoAssignModel.getAutoAssignDetailsByName(
          'auto_route_assignment'
        );
      const { status: isAutoRouteAssignmentEnabled = 0, hub = {} } =
        autoRouteAssignmentDetails || {};
      const { hub_id: autoRouteEnabledHubList = [] } = hub || {};

      if (!isAutoRouteAssignmentEnabled) return;

      const userHubs = await getHubsByUserId(userId);
      const userWiseHubIds = userHubs.map(({ hub_id }) => hub_id);
      const selectedPickupReqList = selectedPickupReqNo.length
        ? await getPickupReqForAutoAssignByPickupReqNo(selectedPickupReqNo)
        : [];
      // Create a map of pickup requests grouped by hub_id
      const hubWisePickupReqMap = selectedPickupReqList.reduce(
        (result, item) => {
          if (!result[item.hub_id]) {
            result[item.hub_id] = [];
          }
          result[item.hub_id].push(item);
          return result;
        },
        {}
      );

      // Fetch zone details
      const [[zoneDetails], autoAssignSettingDetails] = await Promise.all([
        autoAssignModel.getAutoAssignDetailsByName(
          'zone_wise_route_assignment'
        ),
        autoAssignModel.getAutoAssignDetails()
      ]);

      // Process auto-assignment for each user hub
      // Create an array to store promises
      const promises = [];

      userWiseHubIds.forEach((hubId) => {
        const hubDetails = userHubs.find((item) => item.hub_id === hubId);

        if (hubDetails) {
          const selectedPickupReq = hubWisePickupReqMap[hubId.toString()] || [];
          if (
            autoRouteEnabledHubList.includes(0) ||
            autoRouteEnabledHubList.includes(hubId)
          ) {
            if (selectedPickupReqNo.length) {
              promises.push(
                selectedPickupReq.length &&
                  autoAssignRider(
                    hubDetails,
                    zoneDetails,
                    autoAssignSettingDetails,
                    selectedPickupReq
                  )
              );
            } else {
              promises.push(
                autoAssignRider(
                  hubDetails,
                  zoneDetails,
                  autoAssignSettingDetails,
                  selectedPickupReq
                )
              );
            }
          }
        }
      });

      // Execute all promises using Promise.all
      await Promise.all(promises);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = AutoAssign;
