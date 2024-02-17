'use strict';

require('../bin/db')(process.env.NODE_ENV);

const { getHubListForSetting } = require('../models/hub');

const {
  getAutoAssignDetailsByName,
  getAutoAssignDetails
} = require('../models/autoAssign');
const { autoAssignRider } = require('../modules/autoAssignRider');
const AUTO_ROUTE_ASSIGNMENT_SETTING_NAME = 'auto_route_assignment';
const ZONE_SETTING_NAME = 'zone_wise_route_assignment';

(async function () {
  try {
    const [autoRouteAssignmentDetails] = await getAutoAssignDetailsByName(
      AUTO_ROUTE_ASSIGNMENT_SETTING_NAME
    );

    const { status: isAutoRouteAssignmentEnabled = 0, hub = {} } =
      autoRouteAssignmentDetails || {};

    const { hub_id: hubIdList = [] } = hub || {};

    if (!(isAutoRouteAssignmentEnabled && hubIdList.length)) return;

    const [autoAssignEnabledHub, [zoneDetails], autoAssignSettingDetails] =
      await Promise.all([
        getHubListForSetting(hubIdList),
        getAutoAssignDetailsByName(ZONE_SETTING_NAME),
        getAutoAssignDetails()
      ]);

    await Promise.all(
      autoAssignEnabledHub.map((hubDetails) =>
        autoAssignRider(hubDetails, zoneDetails, autoAssignSettingDetails)
      )
    );
  } catch (error) {
    console.error(error);
  } finally {
    process.exit();
  }
})();
