const notificationModel = require('../models/notificationEvent');
const { sendEmail } = require('./sendEmail');
const { sendSms } = require('./sendSms');
const { sendWhatsAppNotification } = require('./sendWhatsApp');

const sendNotification = async (notification_data) => {
	try {
		/**
          type :-
            1- email
            2- sms
            3- WhatsApp
            4- email, WhatsApp
            5- email, sms
            6- email, WhatsApp,sms
         */

		/**
          audience :-
		    1-internal
		    2-external
		    3-Both
		 */

		const emailTypes = [1, 4, 5, 6];
		const smsTypes = [2, 5, 6];
		const whatsAppTypes = [3, 4, 6];

		let {
			emailObj = null,
			sms_content = null,
			eventName,
			contact_number = null,
			whatsAppObj = null,
			whatsapp_contact_number = null,
		} = notification_data;

		const notificationData = await notificationModel.getEventDetailsByEventName(
			eventName
		);

		if (!notificationData.length) {
			return;
		}
		const notificationDetail = notificationData[0];

		const {
			type,
			email_id,
			sms_template,
			email_template,
			contact_no,
			whatsapp_contact,
			whatsapp_template,
			audience,
		} = notificationDetail;

		if (emailObj && emailTypes.includes(Number(type))) {
			let { email = null, name = null, email_content, subject } = emailObj;
			if (!email && email_id) {
				email = email_id.split(',');
			}

			if (Array.isArray(email)) {
				await Promise.allSettled(
					email.map((email) =>
						sendEmail(email, name, email_template, email_content, subject)
					)
				);
			} else if (email) {
				await sendEmail(email, name, email_template, email_content, subject);
			}
		}

		if (sms_content && smsTypes.includes(Number(type))) {
			//send sms notification
			if (!contact_number && contact_no) {
				contact_number = contact_no.split(',');
			}

			if (Array.isArray(contact_number)) {
				await Promise.allSettled(
					contact_number.map((number) =>
						sendSms(sms_content, number, sms_template)
					)
				);
			} else if (contact_number) {
				await sendSms(sms_content, contact_number, sms_template);
			}
		}

		if (whatsAppObj && whatsAppTypes.includes(Number(type))) {
			let whatsAppContactNo;
			if (!whatsapp_contact_number && whatsapp_contact) {
				whatsAppContactNo = whatsapp_contact.split(',');
			}

			if (Array.isArray(whatsAppContactNo)) {
				await Promise.allSettled(
					whatsAppContactNo.map((number) =>
						sendWhatsAppNotification(number, whatsapp_template, whatsAppObj)
					)
				);
			} else if (whatsapp_contact_number) {
				await sendWhatsAppNotification(
					whatsapp_contact_number,
					whatsapp_template,
					whatsAppObj
				);
			}
		}

		return true;
	} catch (exception) {
		console.error(exception);
		throw new Error(exception.message || exception);
	}
};

module.exports = { sendNotification };