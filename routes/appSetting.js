'use strict';

const { Router } = require('express');
const router = Router();
const AppSettingController = require('../controller/appSetting');
const validateRequest = require('../middleware/reqValidator');
const {
	validateAppSettingReq,
	validavalidateAppSettingBySettingId,
	validateDistanceRestrictionReq
} = require('../validation/appSetting');

router.get(
	'/all-setting-details',
	validateRequest(validavalidateAppSettingBySettingId),
	async (req, res) => {
		try {
			const { settingName } = req.query;
			const appSettingController = new AppSettingController();
			const result = await appSettingController.getSettingDataByName(
				settingName
			);
			res.send({ success: true, data: result.data, message: 'Data Retrieved' });
		} catch (exception) {
			console.error(exception);

			res.send({ success: false, message: exception.message || exception });
		}
	}
);

router.post(
	'/contact-number-masking',
	validateRequest(validateAppSettingReq),
	async (req, res) => {
		try {
			const { userList, hubsList, settingName } = req.body;
			const appSettingController = new AppSettingController();
			await appSettingController.contactNumberMasking({
				userList,
				hubsList,
				settingName,
			});
			res.send({ success: true, message: 'Updated successfully' });
		} catch (exception) {
			console.error(exception);
			res.send({ success: false, message: exception.message || exception });
		}
	}
);

router.post(
	'/rider-capacity',
	validateRequest(validateAppSettingReq),
	async (req, res) => {
		try {
			const { userList, hubsList, settingName } = req.body;
			const appSettingController = new AppSettingController();
			await appSettingController.riderCapacity({
				userList,
				hubsList,
				settingName,
			});
			res.send({ success: true, message: 'Updated successfully' });
		} catch (exception) {
			console.error(exception);
			res.send({ success: false, message: exception.message || exception });
		}
	}
);

router.post('/pickup-otp', validateRequest(validateAppSettingReq), async (req, res) => {
	try {
		const { userList, settingName, hubsList } = req.body;
		const appSettingController = new AppSettingController();
		await appSettingController.pickupViaOtp({ userList, settingName, hubsList });
		res.send({ success: true, message: 'Updated successfully' });
	} catch (exception) {
		console.error(exception);
		res.send({ success: false, message: exception.message || exception });
	}
});

router.post('/pickup-signature', validateRequest(validateAppSettingReq), async (req, res) => {
	try {
		const { userList, settingName, hubsList } = req.body;
		const appSettingController = new AppSettingController();
		await appSettingController.pickupViaSignature({
			userList,
			settingName,
			hubsList
		});
		res.send({ success: true, message: 'Updated successfully' });
	} catch (exception) {
		console.error(exception);
		res.send({ success: false, message: exception.message || exception });
	}
});

router.post(
  '/require-location-for-login',
  validateRequest(validateAppSettingReq),
  async (req, res) => {
    try {
      const { userList, hubsList, settingName } = req.body;
      const appSettingController = new AppSettingController();
      await appSettingController.requireLocationForLogin({
        userList,
        hubsList,
        settingName,
      });
      res.send({ success: true, message: 'Updated successfully' });
    } catch (exception) {
      console.error(exception);
      res.send({ success: false, message: exception.message || exception });
    }
  },
);

router.post(
  '/distance-restriction-for-login',
  validateRequest(validateDistanceRestrictionReq),
  async (req, res) => {
    try {
        const { userList, hubsList, settingName, distance } = req.body;
      const appSettingController = new AppSettingController();
      await appSettingController.distanceRestrictionForLogin({
        userList,
        hubsList,
        settingName,
        distance,
      });
      res.send({ success: true, message: 'Updated successfully' });
    } catch (exception) {
      console.error(exception);
      res.send({ success: false, message: exception.message || exception });
    }
  },
);

router.post(
  '/update-status',
  validateRequest(validateAppSettingReq),
  async (req, res) => {
    try {
      const { settingName, status } = req.body;
      const appSettingController = new AppSettingController();
      await appSettingController.updateSettingStatus(settingName, status);
      res.send({ success: true, message: 'Updated successfully' });
    } catch (exception) {
      console.error(exception);

      res.send({ success: false, message: exception.message || exception });
    }
  },
);

router.post('/delivery-otp', validateRequest(validateAppSettingReq, true), async (req, res) => {
	try {
		const { userList, settingName, hubsList } = req.body ?? {};
		const appSettingController = new AppSettingController();
		await appSettingController.deliveryViaOtp({ userList, settingName, hubsList });
		res.send({ success: true, message: 'Updated successfully' });
	} catch (exception) {
		console.error(exception);
		res.send({ success: false, message: exception.message || exception });
	}
});

router.post('/delivery-signature', validateRequest(validateAppSettingReq, true), async (req, res) => {
	try {
		const { userList, settingName, hubsList } = req.body;
		const appSettingController = new AppSettingController();
		await appSettingController.deliveryViaSignature({
			userList,
			settingName,
			hubsList
		});
		res.send({ success: true, message: 'Updated successfully' });
	} catch (exception) {
		console.error(exception);
		res.send({ success: false, message: exception.message || exception });
	}
});


module.exports = router;
