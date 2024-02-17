'use strict';

const zoneMappingModel = require('../models/zoneMapping');
const { getPincodeByHubId } = require('../models/hub_pincode_mapping');

class ZoneMapping {
	static DEFAULT_PAGE = 1;
	static DEFAULT_LIMIT = 25;

	async createNewZone({ hubId, zoneName, pincodes }) {
		try {

			const userSelectedPincodes = await this.checkAlreadyExistPincodeAndZoneName({
				pincodes,
				zoneName,
				hubId,
			});

			const insertZoneObj = {
				hub_id: hubId,
				zone_name: zoneName,
				pincodes: userSelectedPincodes,
				status: 1,
			};
			await zoneMappingModel.createNewZone(insertZoneObj);
			return;
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async checkAlreadyExistPincodeAndZoneName({
		pincodes: userSelectedPincodes,
		zoneName,
		hubId,
		zoneId = null,
	}) {
    const pincodeArrHubWise = await getPincodeByHubId(hubId);
			const pincodeSetHubWise = new Set(
				pincodeArrHubWise.map(({ pincode }) => pincode)
			);

			userSelectedPincodes = userSelectedPincodes
				? Array.from(new Set(userSelectedPincodes.split(',').map(Number)))
				: [];

			const missingPincodes = [];
			userSelectedPincodes.forEach((pincode) => {
				if (!pincodeSetHubWise.has(pincode)) {
					missingPincodes.push(pincode);
				}
			});

			if (missingPincodes.length) {
				throw new Error(
					`Pincode(s) not found in selected hub : ${missingPincodes.join(
						', '
					)}`
				);
			}
		const zoneDataByHubId = await zoneMappingModel.zoneDataByHubId(hubId);

		const alreadyExistPincode = [];

		for (const { pincodes, id, zone_name } of zoneDataByHubId) {
			if (id === Number(zoneId)) {
				continue;
			}

			if (zoneName === zone_name) {
				throw new Error(`Zone name '${zoneName}' already exists.`);
			}

			const pincodesArr = pincodes.split(',').map(Number);
			const duplicatePincodes = userSelectedPincodes.filter((value) =>
				pincodesArr.includes(value)
			);
			alreadyExistPincode.push(...duplicatePincodes);
		}

		if (alreadyExistPincode.length) {
			throw new Error(
				`Pincode already exists: ${alreadyExistPincode.join(', ')}`
			);
		}
    return userSelectedPincodes.join(',');
	}

	async updateZone({ zoneId, hubId, zoneName, pincodes }) {
		try {
			const userSelectedPincodes = await this.checkAlreadyExistPincodeAndZoneName({
				pincodes,
				zoneName,
				hubId,
        zoneId
			});

      const updateZoneObj = {
        pincodes : userSelectedPincodes,
        zone_name : zoneName
      }

			await zoneMappingModel.updateZoneDetailsById(zoneId, updateZoneObj);
			return;
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async updateZoneStatus({ status, zoneId }) {
		try {
			await zoneMappingModel.updateZoneDetailsById(zoneId, { status });
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async getZoneData({ page, offset }) {
		try {
			let hasNext = false,
				hasPrev = false;

			const pageNew = parseInt(page ?? ZoneMapping.DEFAULT_PAGE);

			let limit = parseInt(offset ?? ZoneMapping.DEFAULT_LIMIT);

			const offsetNew = (pageNew - 1) * limit;

			let result = await zoneMappingModel.getZoneDataList(offsetNew, limit + 1);

			if (result.length === limit + 1) {
				hasNext = true;
			}

			if (page > 1) {
				hasPrev = true;
			}

			result = result.slice(0, limit);

			return { data: result, hasNext, hasPrev };
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async getZoneList(hubId) {
		try {
			hubId = hubId.split(',')
			let result = await zoneMappingModel.getZoneList(hubId);
			return result;
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}
}

module.exports = ZoneMapping;
