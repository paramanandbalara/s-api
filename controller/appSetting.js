'use strict';

const appSettingModel = require('../models/appSetting');

class AppSetting {
	async getSettingDataByName(settingName) {
		try {
			const settingData = await appSettingModel.getSettingDataByName(
				settingName
			);

			const data = settingData.map((i) => {
				const {
					hub: { hub_id: hubList = [] } = {}, // Extracting hub_id property and assigning an empty array as default
					user: { user_id: userList = [] } = {}, // Extracting user_id property and assigning an empty array as default,
				} = i || {};
				delete i.hub;
				delete i.user;
				hubList.length
					? (i.hubList = hubList)
					: userList.length
					? (i.userList = userList)
					: i;
				return i;
			});
			return { data };
		} catch (exception) {
			throw new Error(exception.message || exception);
		}
	}

	async contactNumberMasking({ userList, hubsList, settingName }) {
		try {
			hubsList = this.convertStringToArray(hubsList);
			userList = this.convertStringToArray(userList);
			const updateObj = this.getUpdateObjectForAppSetting({
				hubsList,
				userList,
			});
			await appSettingModel.updateAppSettingbySettingName(settingName, updateObj);
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async riderCapacity({ userList, hubsList, settingName }) {
		try {
			hubsList = this.convertStringToArray(hubsList);
			userList = this.convertStringToArray(userList);
			const updateObj = this.getUpdateObjectForAppSetting({
				hubsList,
				userList,
			});
			await appSettingModel.updateAppSettingbySettingName(settingName, updateObj);
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async pickupViaOtp({ userList, settingName, hubsList }) {
		try {
			userList = this.convertStringToArray(userList);
			hubsList = this.convertStringToArray(hubsList);
			const updateObj = this.getUpdateObjectForAppSetting({
				hubsList,
				userList,
			});
			await appSettingModel.updateAppSettingbySettingName(settingName, updateObj);
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async pickupViaSignature({ userList, settingName, hubsList }) {
		try {
			hubsList = this.convertStringToArray(hubsList);
			userList = this.convertStringToArray(userList);
			const updateObj = this.getUpdateObjectForAppSetting({
				hubsList,
				userList,
			});
			await appSettingModel.updateAppSettingbySettingName(settingName, updateObj);
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async requireLocationForLogin({ userList, hubsList, settingName }) {
		try {
			hubsList = this.convertStringToArray(hubsList);
			userList = this.convertStringToArray(userList);

			await appSettingModel.updateAppSettingbySettingName(
				settingName,
				this.getUpdateObjectForAppSetting({hubsList, userList})
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	}

	async distanceRestrictionForLogin({
		userList,
		hubsList,
		settingName,
		distance,
	}) {
		hubsList = this.convertStringToArray(hubsList);
		userList = this.convertStringToArray(userList);

		await appSettingModel.updateAppSettingbySettingName(settingName, {
			...this.getUpdateObjectForAppSetting({hubsList, userList}),
			geoFence: distance,
		});
		try {
		} catch (error) {
			console.error(error);
			throw error;
		}
	}

	async updateSettingStatus(settingName, status) {
		try {
			await appSettingModel.updateAppSettingbySettingName(settingName, { status });
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	convertStringToArray(arrayString) {
		return (
			arrayString && !Array.isArray(arrayString)
				? arrayString.toString().split(',')
				: arrayString
		).map(Number);
	}

	getUpdateObjectForAppSetting({ hubsList, userList }) {
		return {
			hubsList: hubsList?.length ? hubsList : [],
			userList: hubsList?.length ? [] : userList?.length ? userList : [],
		};
	}

	async deliveryViaOtp({ userList, settingName, hubsList }) {
		try {
			userList = this.convertStringToArray(userList);
			hubsList = this.convertStringToArray(hubsList);
			const updateObj = this.getUpdateObjectForAppSetting({
				hubsList,
				userList,
			});
			await appSettingModel.updateAppSettingbySettingName(settingName, updateObj);
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async deliveryViaSignature({ userList, settingName, hubsList }) {
		try {
			hubsList = this.convertStringToArray(hubsList);
			userList = this.convertStringToArray(userList);
			const updateObj = this.getUpdateObjectForAppSetting({
				hubsList,
				userList,
			});
			await appSettingModel.updateAppSettingbySettingName(settingName, updateObj);
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}
}

module.exports = AppSetting;
