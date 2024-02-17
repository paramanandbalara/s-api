'use strict';

const { Router } = require('express');
const router = Router();
const AppNotificationController = require('../controller/appNotification');
const validateRequest = require('../middleware/reqValidator');
const {
	validavalidateAppNotificationByNotificationName,
	validateAppNotificationReq,
	validatePickupCompleteInternal,
	validateChannel
} = require('../validation/appNotification');

router.get(
	'/all-notification-details',
	validateRequest(validavalidateAppNotificationByNotificationName),
	async (req, res) => {
		try {
			const { eventName } = req.query;
			const appNotificationController = new AppNotificationController();
			const result =
				await appNotificationController.getAllNotidicationDataByName(eventName);
			res.send({ success: true, data: result.data, message: 'Data Retrieved' });
		} catch (exception) {
			console.error(exception);
			res.send({ success: false, message: exception.message || exception });
		}
	}
);

router.post(
	'/pickup-complete',
	validateRequest(validateAppNotificationReq),
	async (req, res) => {
		try {
			const {
				audience,
				receiver,
				eventName,
				unsubscribe,
				emailId,
				whatsAppContactNumber,
				smsContactNumber,
			} = req.body;
			const appNotificationController = new AppNotificationController();
			await appNotificationController.updatePickupComplete({
				eventName,
				audience,
				receiver,
				unsubscribe,
				emailId,
				whatsAppContactNumber,
				smsContactNumber,
			});
			res.send({ success: true, message: 'Updated successfully' });
		} catch (exception) {
			console.error(exception);
			res.send({ success: false, message: exception });
		}
	}
);

router.post(
	'/pickup-complete-internal',
	validateRequest(validatePickupCompleteInternal),
	async (req, res) => {
		try {
			const { eventName, emailId, whatsAppContactNumber, smsContactNumber } =
				req.body;
			const appNotificationController = new AppNotificationController();
			await appNotificationController.updatePickupCompleteInternal({
				eventName,
				emailId,
				whatsAppContactNumber,
				smsContactNumber,
			});
			res.send({ success: true, message: 'Updated successfully' });
		} catch (exception) {
			console.error(exception);
			res.send({ success: false, message: exception });
		}
	}
);

router.post(
	'/low-bag-seal',
	validateRequest(validatePickupCompleteInternal),
	async (req, res) => {
		try {
			const {
				eventName,
				emailId,
				whatsAppContactNumber,
				smsContactNumber,
			} = req.body;
			const appNotificationController = new AppNotificationController();
			await appNotificationController.saveNotificationDetails({
				eventName,
				emailId,
				whatsAppContactNumber,
				smsContactNumber,
			});
			res.send({ success: true, message: 'Updated successfully' });
		} catch (exception) {
			console.error(exception);
			res.send({ success: false, message: exception });
		}
	}
);

router.post(
	'/shyptrack-summary',
	validateRequest(validatePickupCompleteInternal),
	async (req, res) => {
		try {
			const {
				eventName,
				emailId,
				whatsAppContactNumber,
				smsContactNumber,
			} = req.body;
			const appNotificationController = new AppNotificationController();

			await appNotificationController.saveNotificationDetails({
				eventName,
				emailId,
				whatsAppContactNumber,
				smsContactNumber,
			});
			res.send({ success: true, message: 'Updated Successfully' });
		} catch (exception) {
			console.error(exception);
			res.send({ success: false, message: exception.message || exception });
		}
	}
);

router.post('/update-channel', validateRequest(validateChannel), async (req, res) => {
	try {
		const { eventName, type } = req.body;
		const appNotificationController = new AppNotificationController();
		await appNotificationController.updateChannel({ eventName, type });
		res.send({ success: true, message: 'Updated Successfully' });
	} catch (exception) {
		console.error(exception);
		res.send({ success: false, message: exception.message || exception });
	}
});

module.exports = router;
