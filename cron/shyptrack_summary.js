'use strict';

const dayjs = require('dayjs');
const express = require('express');
const app = express();
require('../bin/bootstrap')(app);
const hubModel = require('../models/hub');
const riderModel = require('../models/rider');
const orderModel = require('../models/orders');
const { sendNotification } = require('../modules/sendNotification');
const { getAppNotificationByName } = require('../models/appNotification');

const ACTIVE_HUB_STATUS = [1, 2, 3];
const PICKUP_ORDER_STATUS = [4];
const DELIVERY_ORDER_STATUS = [103];
const FAILED_ORDER_STATUS = [16, 17];
const DROPPOFF_STATUS = [18];

const summaryDetailsForWhatsApp = async () => {
	try {
		const whatsAppType = [3, 4, 6, 7];

		const notificationName = 'shyptrack_summary';

		const [appNotificationData] = await getAppNotificationByName(notificationName);

		const { status: notificationStatus, receiver, type: notificationType, audience } = appNotificationData;

		if (!notificationStatus) {
			return true;
		}

		const startDate = dayjs(new Date()).format('YYYY-MM-DD 00:00:00');

		const endDate = dayjs(new Date()).format('YYYY-MM-DD 23:59:59');

		const [
			activeHubsResult,
			activeRidersResult,
			pickupOrdersResult,
			deliveryOrdersResult,
			failedOrdersResult,
			dropOffResult,
		] = await Promise.all([
			hubModel.getActiveHub(ACTIVE_HUB_STATUS),
			riderModel.getActiveRiders(startDate, endDate),
			orderModel.getStatusWiseOrderCount(PICKUP_ORDER_STATUS, startDate, endDate),
			orderModel.getStatusWiseOrderCount(DELIVERY_ORDER_STATUS, startDate, endDate),
			orderModel.getStatusWiseOrderCount(FAILED_ORDER_STATUS, startDate, endDate),
			orderModel.getStatusWiseOrderCount(DROPPOFF_STATUS, startDate, endDate),
		]);

		const activeHubCount = activeHubsResult[0]?.active_hub || 0;
		const activeRidersCount = activeRidersResult[0]?.activeRidersCount || 0;
		const pickupOrderCount = pickupOrdersResult[0]?.orderCount || 0;
		const deliveryOrderCount = deliveryOrdersResult[0]?.orderCount || 0;
		const dropOffOrderCount = dropOffResult[0]?.orderCount || 0;
		const failedOrderCount = failedOrdersResult[0]?.orderCount || 0;

		if (audience === 1 && whatsAppType.includes(notificationType)) {
			const whatsAppObj = [
				{
					type: 'text',
					text: dayjs().format('DD-MM-YYYY'),
				},
				{
					type: 'text',
					text: activeHubCount,
				},
				{
					type: 'text',
					text: activeRidersCount,
				},
				{
					type: 'text',
					text: pickupOrderCount,
				},
				{
					type: 'text',
					text: dropOffOrderCount,
				},
				{
					type: 'text',
					text: failedOrderCount,
				},
				{
					type: 'text',
					text: deliveryOrderCount,
				},
			];

			const data = {
				eventName: 'shyptrack_summary',
				whatsAppObj,
			};
			await sendNotification(data);
		}
	} catch (exception) {
		console.error(exception);
		throw exception;
	} finally {
		process.exit();
	}
};

summaryDetailsForWhatsApp();
