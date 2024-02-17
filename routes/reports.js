'use strict';
const express = require('express');
const router = express.Router();
const FAILURE_REASON_CONTROLLER = require('../controller/failureReason');
const RIDER_CONTROLLER = require('../controller/rider');
const LINEHAUL_CONTROLLER = require('../controller/linehaul');
const STOCK_CONTROLLER = require('../controller/stock');
const DROPOFF_CONTROLLER = require('../controller/dropoff');
const validateRequest = require('../middleware/reqValidator');
const {
  addOrRemoveFavouriteSchema,
  inventoryExport
} = require('../validation/reports');
const ReportController = require('../controller/reports');
const InventoryController = require('../controller/inventoryRecon');
const NotificationController = require('../controller/notification');
const { getNotificationReportValidation } = require('../validation/notification');

router.get('/reports/failure', async (req, res, next) => {
  try {
    const user_id = req.header('x-userid');

    const { startDate, endDate, page, offset } = req.query;

    const filters = { startDate, endDate, page, offset } || {};

    const FAILURE_REASON = new FAILURE_REASON_CONTROLLER();

    const result = await FAILURE_REASON.getFailedAwbs(filters, user_id);

    res.send({
      success: true,
      data: result.data,
      hasNext: result.hasNext,
      hasPrev: result.hasPrev,
      message: 'Data Retrieved'
    });
  } catch (error) {
    console.error(__line, error);
    res.send({ success: false, message: error.message || error });
  }
});

router.get('/reports/failure/export', async (req, res, next) => {
  try {
    const { startDate, endDate, page, offset } = req.query;

    const user_id = req.header('x-userid');

    const filters = { startDate, endDate, page, offset };

    const FAILURE_REASON = new FAILURE_REASON_CONTROLLER();

    const result = await FAILURE_REASON.getFailedAwbsExport(filters, user_id);

    res.send({ success: true, filepath: result, message: 'Data Retrieved' });
  } catch (error) {
    console.error(__line, error);
    res.send({ success: false, message: error.message || error });
  }
});

router.get('/reports/checkincheckout', async (req, res, next) => {
  try {
    const user_id = req.header('x-userid');

    const { startDate, endDate, page, offset, rider_id } = req.query;

    const filters = { startDate, endDate, page, offset, rider_id } || {};

    const RIDER = new RIDER_CONTROLLER();

    const result = await RIDER.getCheckinCheckoutData(filters, user_id);
    res.send({
      success: true,
      data: result.data,
      hasNext: result.hasNext,
      hasPrev: result.hasPrev,
      message: 'Data Retrieved'
    });
  } catch (error) {
    console.error(__line, error);
    res.send({ success: false, message: error.message || error });
  }
});

router.get('/reports/checkincheckout/image', async (req, res, next) => {
  try {
    const user_id = req.header('x-userid');

    const { clicked_on, checkin_date, checkout_date, rider_id } = req.query;

    const filters = { clicked_on, checkin_date, checkout_date, rider_id } || {};

    const RIDER = new RIDER_CONTROLLER();

    const result = await RIDER.getCheckinCheckoutImag(filters, user_id);

    res.send({ success: true, data: result, message: 'Data Retrieved' });
  } catch (error) {
    console.error(__line, error);
    res.send({ success: false, message: error.message || error });
  }
});

router.get('/reports/linehaul/manifest/export', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const LINEHAUL = new LINEHAUL_CONTROLLER();

    const result = await LINEHAUL.getLinhaulManifestDataExport({
      startDate,
      endDate
    });

    res.send({ success: true, filepath: result, message: 'Data Retrieved' });
  } catch (error) {
    console.error(__line, error);
    res.send({ success: false, message: error.message || error });
  }
});

router.get('/reports/checkincheckout/export', async (req, res, next) => {
  try {
    const { startDate, endDate, rider_id } = req.query;

    const user_id = req.header('x-userid');

    const filters = { startDate, endDate, rider_id };

    const RIDER = new RIDER_CONTROLLER();

    const result = await RIDER.getcheckincheckoutExport(filters, user_id);

    res.send({ success: true, filepath: result, message: 'Data Retrieved' });
  } catch (error) {
    console.error(__line, error);
    res.send({ success: false, message: error.message || error });
  }
});

router.get('/reports/baginventory', async (req, res, next) => {
  try {
    const { startDate, endDate, code, city, page, offset, hub_id } = req.query;

    const user_id = req.header('x-userid');

    const filters = { startDate, endDate, code, city, page, offset, hub_id };

    const STOCK = new STOCK_CONTROLLER();

    const result = await STOCK.getBagInventoryData(filters, user_id);

    res.send({ success: true, data: result.data, message: 'Data Retrieved' });
  } catch (error) {
    console.error(__line, error);
    res.send({ success: false, message: error.message || error });
  }
});

router.get('/reports/baginventory/export', async (req, res, next) => {
  try {
    const { startDate, endDate, hub_id } = req.query;

    const user_id = req.header('x-userid');

    const filters = { startDate, endDate, hub_id };

    const STOCK = new STOCK_CONTROLLER();

    const result = await STOCK.getBagInventoryExport(filters, user_id);

    res.send({ success: true, filepath: result, message: 'Data Retrieved' });
  } catch (error) {
    console.error(__line, error);
    res.send({ success: false, message: error.message || error });
  }
});

router.get('/dropoff/export', async (req, res, next) => {
  try {
    const { startDate, endDate, hub_id } = req.query;

    const DROPOFF = new DROPOFF_CONTROLLER();

    const result = await DROPOFF.getDropOffExport(startDate, endDate, hub_id);

    res.send({ success: true, filepath: result, message: 'Data Retrieved' });
  } catch (error) {
    console.error(__line, error);
    res.send({ success: false, message: error.message || error });
  }
});

router.post(
  '/reports/add-or-remove-favourite',
  validateRequest(addOrRemoveFavouriteSchema),
  async (req, res, next) => {
    try {
      const userId = req.header('x-userid');
      const reportController = new ReportController();
      const { reportId, value } = req.body;
      await reportController.addOrRemoveToFavourite(userId, {
        reportId: Number(reportId),
        value: Number(value)
      });
      res.send({ success: true, message: 'Favourites has been updated' });
    } catch (error) {
      console.error(__line, error);
      res.send({ success: false, message: error.message || error });
    }
  }
);

router.get('/reports/list', async (req, res, next) => {
  try {
    const reportController = new ReportController();
    const userId = req.header('x-userid');
    const result = await reportController.getReportList(userId);
    res.send({ success: true, data: result });
  } catch (error) {
    console.error(__line, error);
    res.send({ success: false, message: error.message || error });
  }
});

router.get(
  '/inventory/export/monthwise',
  validateRequest(inventoryExport),
  async (req, res, next) => {
    const user_id = req.header('x-userid');

    const { startDate, endDate, hub_id } = req.query;

    const INVENTORY = new InventoryController();

    INVENTORY.getInventoryExport({
      startDate,
      endDate,
      hub_id,
      user_id,
      monthwise: true
    });

    res.send({ success: true, message: 'An Email will be sent to you' });
  }
);

router.get('/reports/notification', validateRequest(getNotificationReportValidation), async (req, res, next) => {
  try {
    const notificationController = new NotificationController();
    const userId = req.header('x-userid');
    const { startDate, endDate, notificationName } = req.query;
    const result = await notificationController.getNotificationReport({
      userId,
      startDate,
      endDate,
      notificationName
    });
    res.send({ success: true, data: result });
  } catch (error) {
    console.error(__line, error);
    res.send({ success: false, message: error.message || error });
  }
});

module.exports = router;
