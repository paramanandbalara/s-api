'use strict';

const Yup = require('yup');

const validateAppNotificationReq = Yup.object({
	body: Yup.object({
		audience : Yup.number().integer().positive().required("Audience not found"),
		receiver : Yup.string().required("Receiver not found"),
		eventName: Yup.string().required("Event name is not found"),
		unsubscribe: Yup.string().max(500, "Unsubscribe must be at most 500 characters").trim(),
		emailId: Yup.string().trim(),
		whatsAppContactNumber : Yup.string().trim(),
		smsContactNumber : Yup.string().trim(),
	}),
  });

  const validatePickupCompleteInternal = Yup.object({
	body: Yup.object({
		eventName: Yup.string().required("Event name is not found"),
		emailId: Yup.string().trim(),
		whatsAppContactNumber : Yup.string().trim(),
		smsContactNumber : Yup.string().trim(),
	}),
  });

const validavalidateAppNotificationByNotificationName = Yup.object({
	query: Yup.object().shape({
		eventName: Yup.string().required("Event name is not found")
	}),
});

const validateChannel = Yup.object({
	body: Yup.object().shape({
		eventName: Yup.string().required("Event name is not found"),
		type: Yup.number().integer().required("Notification type not found")
	}),
});

module.exports = { validateAppNotificationReq, validavalidateAppNotificationByNotificationName, validatePickupCompleteInternal, validateChannel };
