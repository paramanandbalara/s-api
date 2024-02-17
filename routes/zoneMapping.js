'use strict';

const { Router } = require('express');
const router = Router();
const ZoneMappingController = require('../controller/zoneMapping');
const validateRequest = require('../middleware/reqValidator');
const { createZone, updateZoneStatus, updateZone, zoneList } = require('../validation/zoneMapping');

router.post('/create-zone', validateRequest(createZone), async (req, res) => {
	try {
		const { hubId, zoneName, pincodes } = req.body;
		const zoneMappingController = new ZoneMappingController();
		await zoneMappingController.createNewZone({
			hubId,
			zoneName,
			pincodes,
		});
		res.send({ success: true, message: 'Data saved successfully' });
	} catch (exception) {
		console.error(exception);
		res.send({ success: false, message: exception.message });
	}
});

router.post(
	'/update-zone-status',
	validateRequest(updateZoneStatus),
	async (req, res) => {
		try {
			const { status, zoneId } = req.body;
			const zoneMappingController = new ZoneMappingController();
			await zoneMappingController.updateZoneStatus({ status, zoneId });
			res.send({ success: true, message: 'Update successfully' });
		} catch (exception) {
			console.error(exception);
			res.send({ success: false, message: exception.message });
		}
	}
);

router.post(
	'/update-zone',
	validateRequest(updateZone),
	async (req, res) => {
		try {
			const { zoneId, hubId, zoneName, pincodes } = req.body;
			const zoneMappingController = new ZoneMappingController();
			await zoneMappingController.updateZone( { zoneId, hubId, zoneName, pincodes } );
			res.send({ success: true, message: 'Update successfully' });
		} catch (exception) {
			console.error(exception);
			res.send({ success: false, message: exception.message });
		}
	}
);

router.get('/get-zone-data', async (req, res) => {
	try {
		let { page, offset } = req.query;
		const zoneMappingController = new ZoneMappingController();
		const result = await zoneMappingController.getZoneData({ page, offset });
		res.send({
			success: true,
			data: result.data,
			hasNext: result.hasNext,
			hasPrev: result.hasPrev,
			message: 'Data retrieved',
		});
	} catch (exception) {
		console.error(exception);
		res.send({ success: false, message: exception.message });
	}
});

router.get('/zone-list', validateRequest(zoneList), async (req, res) => {
	try {
		let {hubId} = req.query;
		const zoneMappingController = new ZoneMappingController();
		const result = await zoneMappingController.getZoneList(hubId);
		res.send({
			success: true,
			data: result,
			message: 'Data retrieved',
		});
	} catch (exception) {
		console.error(exception);
		res.send({ success: false, message: exception.message });
	}
});

module.exports = router;
