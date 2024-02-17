'use strict';

const appNotificationModel = require('../models/appNotification');

class AppNotification {
	async getAllNotidicationDataByName(eventName) {
		try {
			const notificationData =
				await appNotificationModel.getAppNotificationByName(eventName);

			return { data: notificationData };
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async updatePickupComplete({
		eventName,
		audience,
		receiver,
		unsubscribe,
		emailId, 
		whatsAppContactNumber, 
		smsContactNumber
	}) {
		try {
			// Splitting the 'unsubscribe' string into an array based on the comma separator
			unsubscribe = unsubscribe.split(',');

			// Creating a new array with unique elements using the spread operator and the Set data structure
			const uniqueArray = [...new Set(unsubscribe)];

			// Joining the elements of the uniqueArray back into a string using commas as separators
			unsubscribe = uniqueArray.join(',');

			const updateNotificationObj = {
				audience,
				receiver,
				unsubscribe,
				email_id : emailId,
                contact_no : smsContactNumber,
                whatsapp_contact : whatsAppContactNumber
			};

			await appNotificationModel.updateAppNotificationByName(
				eventName,
				updateNotificationObj
			);
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async updatePickupCompleteInternal({
		eventName,
		emailId,
		whatsAppContactNumber,
		smsContactNumber
	}) {
		try {
			const updateNotificationObj = {
				email_id : emailId,
                contact_no : smsContactNumber,
                whatsapp_contact : whatsAppContactNumber
			};

			await appNotificationModel.updateAppNotificationByName(
				eventName,
				updateNotificationObj
			);
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async saveNotificationDetails({
		eventName,
		emailId, 
		whatsAppContactNumber,
		smsContactNumber 
	}) {
		try {
			const updateNotificationObj = {
				email_id : emailId,
                contact_no : smsContactNumber,
                whatsapp_contact : whatsAppContactNumber			};

			await appNotificationModel.updateAppNotificationByName(
				eventName,
				updateNotificationObj
			);
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async updateChannel({eventName, type}) {
		try {
			const updateNotificationObj = {
				type
			}

			await appNotificationModel.updateAppNotificationByName(
				eventName,
				updateNotificationObj
			); 
		}
		catch(exception) {
			console.error(exception);
			throw exception;
		}
	}
}

module.exports = AppNotification;
