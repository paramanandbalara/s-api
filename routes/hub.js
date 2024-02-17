'use strict';

const express = require('express');
const router = express.Router();
const os = require('os');
const multer = require('multer');
const { validateHub } = require('../validation/hub');
const HubController = require('../controller/hub');

const multerStorage = multer.diskStorage({
  destination: os.tmpdir() + '/shyptrack',
  filename: function (req, file, cb) {
    let name = Date.now() + '-' + file.originalname;
    cb(null, name);
  },
});

const upload = multer({
  storage: multerStorage,
});

router.post('/hub/create', async (req, res, next) => {
  try {
    const hubController = new HubController();

    const body = await validateHub().validate(req.body);

    const result = await hubController.createHub(body);
    if (!result) {
      throw new Error('Error While Creating Hub');
    }

    res.send({ success: true, message: result });
  } catch (exception) {
    console.error(exception.message || exception);

    res.send({ success: false, message: exception.message });
  }
});

router.get('/hub/list', async (req, res, next) => {
  try {
    const { page, offset, is_pagination, hub_code, hub_city } = req.query;

    const user_id = req.header('x-userid');

    const hubController = new HubController();

    const result = await hubController.getHubsListBasedOnUserId(
      page,
      offset,
      is_pagination,
      user_id,
      hub_code,
      hub_city,
    );

    res.send({
      success: true,
      data: result.data,
      hasNext: result.hasNext,
      hasPrev: result.hasPrev,
      message: 'Data Retrieved',
    });
  } catch (exception) {
    console.error(exception.message || exception);

    res.send({ success: false, message: exception.message || exception });
  }
});

router.post('/citywise/hub/list', async (req, res, next) => {
  try {
    const { city } = req.body;
    if (!city || city.length == 0) throw Error('city not provided');

    const hubController = new HubController();

    const result = await hubController.getCityWiseHubs(city);

    res.send({ success: true, data: result, message: 'Data Retrieved' });
  } catch (exception) {
    console.error(exception.message || exception);

    res.send({ success: false, message: exception.message || exception });
  }
});

router.post('/hub/edit/:id', async (req, res, next) => {
  try {
    const { id: hubId } = req.params;
    if (!hubId) {
      throw new Error('id required in params');
    }
    const body = req.body;
    const hubController = new HubController();
    const result = await hubController.editHub(hubId, body);
    res.send({ success: true, message: result });
  } catch (exception) {
    console.error(exception.message || exception);

    res.send({ success: false, message: exception.message || exception });
  }
});

router.get('/hub/users', async (req, res, next) => {
  try {
    const { page, offset, hub_code, hub_city, role_id, contact_no } = req.query;

    const hubController = new HubController();

    const result = await hubController.getHubUsers(
      page,
      offset,
      hub_code,
      hub_city,
      role_id,
      contact_no,
    );

    res.send({
      success: true,
      data: result.data,
      hasNext: result.hasNext,
      hasPrev: result.hasPrev,
      message: 'Data Retrieved',
    });
  } catch (exception) {
    console.error(exception.message || exception);

    res.send({ success: false, message: exception.message || exception });
  }
});

router.get('/hub/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const hubController = new HubController();

    const result = await hubController.getHubDetails(id);

    res.send({ success: true, data: result, message: 'Data Retrieved' });
  } catch (exception) {
    console.error(exception.message || exception);

    res.send({ success: false, message: exception.message || exception });
  }
});

router.get('/hub/gateway/code', async (req, res, next) => {
  try {
    const user_id = req.header('x-userid');
    const hubController = new HubController();

    const result = await hubController.getGatwayDetails(user_id);

    res.send({ success: true, data: result, message: 'Data Retrieved' });
  } catch (exception) {
    console.error(exception.message || exception);

    res.send({ success: false, message: exception.message || exception });
  }
});

router.get('/cities', async (req, res, next) => {
  try {
    const hubController = new HubController();

    const cities = await hubController.getCities();

    res.send({ success: true, message: 'Data Retrieved', cities });
  } catch (exception) {
    console.error(exception.message || exception);

    res.send({ success: false, message: exception.message || exception });
  }
});

router.get('/hub/gateway/list', async (req, res, next) => {
  try {
    const hubController = new HubController();

    const result = await hubController.getGatwayList();

    res.send({ success: true, data: result, message: 'Data Retrieved' });
  } catch (exception) {
    console.error(exception.message || exception);

    res.send({ success: false, message: exception.message || exception });
  }
});

router.get('/hub/connection/list', async (req, res, next) => {
  try {
    const hubController = new HubController();

    const result = await hubController.getconnectionList();

    res.send({ success: true, data: result, message: 'Data Retrieved' });
  } catch (exception) {
    console.error(exception.message || exception);

    res.send({ success: false, message: exception.message || exception });
  }
});

router.get('/pincode/list', async (req, res, next) => {
  try {
    const user_id = req.header('x-userid');

    const hubController = new HubController();

    const result = await hubController.getPincodeLocation(user_id);
    res.send({ success: true, data: result, message: 'Data Retrieved' });
  } catch (exception) {
    console.error(exception.message || exception);

    res.send({ success: false, message: exception.message || exception });
  }
});

router.get('/hub/all/list', async (req, res, next) => {
  try {
    const hubController = new HubController();

    const { all_hubs: allHubs } = req.query;

    const result = await hubController.getAllHubsList(allHubs);

    res.send({ success: true, data: result, message: 'Data Retrieved' });
  } catch (exception) {
    console.error(exception.message || exception);

    res.send({ success: false, message: exception.message || exception });
  }
});

router.get('/hub/wise/riderlist', async (req, res, next) => {
  try {
    const hubController = new HubController();
    const { hub_id } = req.query;

    const result = await hubController.getHubWiseRiderList(hub_id);

    res.send({ success: true, data: result, message: 'Data Retrieved' });
  } catch (exception) {
    console.error(exception);

    res.send({ success: false, message: exception.message || exception });
  }
});

router.get('/hub/serviceability/export', async (req, res, next) => {
  try {
    const { hub_id: hubId } = req.query;

    const hubController = new HubController();

    const result = await hubController.getPincodeExport(hubId);

    res.send({
      success: true,
      filepath: result,
      message: 'Pincode export downloaded successfully',
    });
  } catch (error) {
    console.error(__line, error);
    res.send({ success: false, message: error.message || error });
  }
});

router.post(
  '/hub/serviceability/upload',
  upload.single('hub_pincode'),
  async (req, res, next) => {
    try {
      const hubController = new HubController();
      const file = req.file;
      const { hub_id: hubId } = req.body;
      await hubController.uploadPincodeList(hubId, file);
      res.send({
        success: true,
        message: 'Serviceability list uploaded successfully',
      });
    } catch (exception) {
      console.error(exception.message || exception);
      res.send({ success: false, message: exception.message || exception });
    }
  },
);

router.get('/all-rider-list', async (req, res, next) => {
  try {
    const hubController = new HubController();
    const isRider = true;
    const riderList = await hubController.getUserListRiderOrOther(isRider);
    res.send({
      success: true,
      data: riderList
    });
  } catch (exception) {
    console.error(exception.message || exception);
    res.send({ success: false, message: exception.message || exception });
  }
});

router.get('/all-user-list', async (req, res, next) => {
  try {
    const hubController = new HubController();
    const userList = await hubController.getUserListRiderOrOther();
    res.send({
      success: true,
      data: userList,
    });
  } catch (exception) {
    console.error(exception.message || exception);
    res.send({ success: false, message: exception.message || exception });
  }
});

router.get('/all-hub-list', async (req, res, next) => {
  try {
    const hubController = new HubController();
    const allHubList = await hubController.getAllHubList();
    res.send({
      success: true,
      data: allHubList,
    });
  } catch (exception) {
    console.error(exception.message || exception);
    res.send({ success: false, message: exception.message || exception });
  }
});

router.get('/zone-enabled-hub-list', async (req, res, next) => {
  try {
    const hubController = new HubController();
    const zoneEnabledHubList = await hubController.zoneEnabledHubList();
    res.send({
      success: true,
      data: zoneEnabledHubList,
    });
  } catch (exception) {
    console.error(exception.message || exception);
    res.send({ success: false, message: exception.message || exception });
  }
});

module.exports = router;
