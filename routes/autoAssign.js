'use strict';

const { Router } = require('express');
const router = Router();
const AutoAssignController = require('../controller/autoAssign');
const {
  validateAddOrEditHubReq,
  updateStatus,
  riderStartLocation,
  autoAssignMethod,
  considerRiderCapicity,
  serviceType,
  singlePackageWeightLimit,
  maxRequestPerRider,
  autoAssignmentRouteMethod
} = require('../validation/autoAssign');
const validateRequest = require('../middleware/reqValidator');

router.get('/details', async ({ query }, res) => {
  try {
    const autoAssignController = new AutoAssignController();
    const { autoAssignName } = query;
    const result = await autoAssignController.getAutoAssignDetails(
      autoAssignName
    );
    res.send({ success: true, data: result, message: 'Data Retrieved' });
  } catch (error) {
    console.error(error);
    res.send({ success: false, message: error.message || error });
  }
});

router.post(
  '/update-status',
  validateRequest(updateStatus),
  async (req, res) => {
    try {
      const autoAssignController = new AutoAssignController();
      const { autoAssignName: settingName, status } = req.body;
      await autoAssignController.updateAutoAssignDetails({
        settingName,
        status
      });
      res.send({ success: true, message: 'status updated successfully' });
    } catch (error) {
      console.error(error);
      res.send({ success: false, message: error.message || error });
    }
  }
);

router.post(
  '/add-edit-hub',
  validateRequest(validateAddOrEditHubReq),
  async (req, res) => {
    try {
      const autoAssignController = new AutoAssignController();
      const { autoAssignName: settingName, hubsList } = req.body;
      await autoAssignController.updateAutoAssignDetails({
        settingName,
        hubsList
      });
      res.send({ success: true, message: 'Updated successfully' });
    } catch (error) {
      console.error(error);
      res.send({ success: false, message: error.message || error });
    }
  }
);

router.post(
  '/rider-start-location',
  validateRequest(riderStartLocation),
  updateAutoAssignDetails
);
router.post(
  '/assign-method',
  validateRequest(autoAssignMethod),
  updateAutoAssignDetails
);

router.post(
  '/consider-rider-vehicle-capicity',
  validateRequest(considerRiderCapicity),
  updateAutoAssignDetails
);

router.post(
  '/service-type',
  validateRequest(serviceType),
  updateAutoAssignDetails
);

router.post(
  '/single-package-weight-limit',
  validateRequest(singlePackageWeightLimit),
  updateAutoAssignDetails
);

router.post(
  '/max-request-per-rider',
  validateRequest(maxRequestPerRider),
  updateAutoAssignDetails
);

router.post(
  '/route-method',
  validateRequest(autoAssignmentRouteMethod),
  updateAutoAssignDetails
);

router.get('/is-enable', async (req, res) => {
  try {
    const autoAssignController = new AutoAssignController();
    const userId = req.header('x-userid');
    const checkIsAutoAssignEnabled =
      await autoAssignController.checkIsAutoAssignEnabled(userId);
    res.send({
      success: true,
      isAutoAssignEnabled: checkIsAutoAssignEnabled
    });
  } catch (error) {
    console.error(error);
    res.send({ success: false, message: error.message || error });
  }
});

router.post('/rider-assign', async (req, res) => {
  try {
    const userId = req.header('x-userid');
    const { selectedPickupReqNo = [] } = req.body;
    const autoAssignController = new AutoAssignController();
    await autoAssignController.autoAssignRider(userId, selectedPickupReqNo);
    res.send({ success: true, message: 'Rider Assigned sucessfully' });
  } catch (error) {
    console.error(error);
    res.send({ success: false, message: error.message || error });
  }
});

async function updateAutoAssignDetails(req, res) {
  try {
    const autoAssignController = new AutoAssignController();
    const { settingName } = req.params;
    await autoAssignController.updateOtherSettings(settingName, req.body);
    res.send({ success: true, message: 'Updated successfully' });
  } catch (error) {
    console.error(error);
    res.send({ success: false, message: error.message || error });
  }
}

module.exports = router;
