const pickupVerifyModel = require('../models/pickupVerify');
const dayjs = require('dayjs');
const getrateOtp = require('../modules/gererateOtp');
const { sendOtp } = require('../modules/sendOtp');
const md5 = require('md5');
const uploadDocument = require('../modules/uploadDocument');
const routeAssignmentModel = require('../models/routeAssignment');
const ordersModel = require('../models/orders');
const s3Module = require('../modules/s3');
const os = require('os');
const crypto = require('crypto');
const CsvWriter = require('../modules/csvWriter');
const fs = require('fs');
const { sendNotification } = require('../modules/sendNotification');
const { getSellerEmail } = require('../modules/getDataFromShypmax');
const pickupRequestModule = require('../modules/pickupDeliveryRequest');
const { getAppNotificationByName } = require('../models/appNotification');
const { getSettingDataByName } = require('../models/appSetting');

const schema = [
	{ header: 'AWB', key: 'awb', coerceString: true },
	{ header: 'Shypmax ID', key: 'shypmax_id', coerceString: true },
	{ header: 'Order No.', key: 'order_number', coerceString: true },
];

const BATCH_SIZE = 100;

class PickupVerify {
	/**
	 * This function gets pickup details for a given route request assigned ID and rider ID.
	 * @param {number} route_request_assigned_id - The ID of the route request assigned.
	 * @param {number} rider_id - The ID of the rider.
	 * @returns {Object} - An object containing pickup details for the given route request assigned ID and rider ID.
	 * @throws {Error} - Throws an error if data is not found or an exception occurs.
	 */

	async getPickupDetails(routeRequestAssignedId, riderId) {
		try {
			//  Pickup via 5 - otp and 6 - signature
			const settingName = ['pickup_via_otp', 'pickup_via_signature'];

			let [pickupReqAuthDetails] = await pickupVerifyModel.getPickedAwbCount(
				routeRequestAssignedId,
				riderId
			);

			let is_auth = 0;
			let message = '';
			let otp_based = 0;
			let signature_based = 0;

			// If no pickupReqAuthDetails exists, return an empty object
			if (!pickupReqAuthDetails) {
				return {
					message,
					is_auth,
				};
			}

			let { hub_id } = pickupReqAuthDetails;

			const appSettingData = await getSettingDataByName(settingName);

			const {
				hub: { hub_id: hubListOtp = [] } = {}, // Extracting hub_id property and assigning an empty array as default
				user: { user_id: userListOtp = [] } = {}, // Extracting user_id property and assigning an empty array as default
				status: settingStatusOtp, // Extracting status property
			} = appSettingData[0] || {}; // Extracting otp_required property and assigning an empty array as default, Extracting signature_required property and assigning an empty array as default

			const {
				hub: { hub_id: hubListSign = [] } = {}, // Extracting hub_id property and assigning an empty array as default
				user: { user_id: userListSign = [] } = {}, // Extracting user_id property and assigning an empty array as default
				status: settingStatusSign, // Extracting status property
			} = appSettingData[1] || {}; // Extracting otp_required property and assigning an empty array as default, Extracting signature_required property and assigning an empty array as default
			// If the setting status is not equal to 1, return an empty object
			
			if (settingStatusOtp !== 1 && settingStatusSign !== 1) {
				return { message: '', is_auth: 0 };
			}

			const otpCondition =
				settingStatusOtp === 1 &&
				(userListOtp.includes(0) ||
					hubListOtp.includes(0) ||
					userListOtp.includes(Number(riderId)) ||
					hubListOtp.includes(Number(hub_id)));

			const signCondition =
				settingStatusSign === 1 &&
				(hubListSign.includes(0) ||
					userListSign.includes(0) ||
					hubListSign.includes(Number(hub_id)) ||
					userListSign.includes(Number(riderId)));

			if (signCondition || otpCondition) {
				is_auth = 1;

				// Determine the appropriate message based on the conditions
				if (otpCondition && signCondition) {
					otp_based = 1;
					signature_based = 1;
					message = 'Package picked-up confirmation through ';
				} else if (signCondition) {
					signature_based = 1;
					message = 'Package picked-up confirmation through Signature';
				} else if (otpCondition) {
					otp_based = 1;
					message = 'Package picked-up confirmation through OTP';
				} else {
					message = '';
				}
			}
			return {
				...pickupReqAuthDetails,
				message,
				is_auth,
				signature_based,
				otp_based,
			};
		} catch (exception) {
			console.error(exception);
			throw new Error(exception.message || exception);
		}
	}

	async sendVerifyOTP(req, res) {
		try {
			const rider_id = req.header('x-userid');

			const body = Object.assign({}, req.body);

			const { contact_number, picked_awb_count, contact_name } = body;

			const otp = await getrateOtp.generateOtp();

			await sendOtp(otp, contact_number, 'SHYPTRACK_PICKUP_COMPLETE_OTP');

			const otp_token = md5(Number(otp));

			res.append('otp_token', otp_token);

			return { success: true, message: `OTP sent` };
		} catch (exception) {
			console.error(exception);
			throw new Error(exception.message || exception);
		}
	}

	async verifyPickupOTP(otp_token, rider_id, body) {
		try {
			const {
				otp,
				is_registered_number,
				otp_contact_name,
				otp_contact_number,
				is_auth,
				route_request_assigned_id,
			} = body;

			const route_request_details = await pickupVerifyModel.getPickedAwbCount(
				route_request_assigned_id,
				rider_id
			);

			if (!route_request_details.length) {
				throw new Error('Something went wrong');
			}
			const { pickup_request_id, pickup_awb_count, pickup_request_no } =
				route_request_details[0];
			let hub_data = await pickupVerifyModel.getHubId(rider_id);

			const { hub_id, name } = hub_data?.[0] || {};

			if (is_auth) {
				if (!otp) {
					throw new Error('OTP not found');
				}

				if (otp_contact_number?.toString()?.length != 10) {
					throw new Error('Please enter correct mobile number');
				}

				const encryptedOtp = md5(Number(otp));

				if (otp_token !== encryptedOtp) {
					throw new Error('Please enter correct OTP');
				}

				const insertObj = {
					request_id: pickup_request_id,
					user_id: rider_id,
					hub_id,
					awb_count: pickup_awb_count,
					is_registered_number,
					otp_contact_number,
					otp_contact_name,
					otp_verifed_date: new Date(),
					type: 1, // for pickup
				};

				await pickupVerifyModel.savePickupVerifyOTP(insertObj);
			}

			await this.pickupComplete(pickup_request_no, route_request_assigned_id);

			const emailBody = {
				pickup_request_id,
				pickup_request_no,
				pickup_awb_count,
				name,
				otp_contact_number,
				is_auth,
			};

			try {
				this.sendSellerEmail(emailBody);
			} catch (exception) {
				console.error(exception);
			}

			return true;
		} catch (exception) {
			console.error(exception);
			throw new Error(exception.message || exception);
		}
	}

	async pickupSignature(body, rider_id) {
		try {
			let {
				pickup_request_no,
				signature,
				signature_type,
				is_auth,
				route_request_assigned_id,
				pickup_request_id,
				pickup_awb_count,
				sign_name
			} = body;
			let pickedOrderCount;

			if (!pickup_awb_count) {
				pickedOrderCount = await pickupVerifyModel.getPickupAwbCount(
					route_request_assigned_id
				);
				pickup_awb_count = pickedOrderCount[0].picked_order_count;
			}
			let hub_data = await pickupVerifyModel.getHubId(rider_id);

			const { name, hub_id } = hub_data?.[0] || {};

			if (is_auth) {
				if (signature && signature_type) {
					const upload_data = {
						file_name: signature,
						file_type: signature_type,
						key: `signature/pickup/${pickup_request_no}-${dayjs(
							new Date()
						).format('YYYY-MM-DD')}.${signature_type}`,
					};

					await uploadDocument.uploadDocument(upload_data);
				}

				const insertObj = {
					request_id: pickup_request_id,
					user_id: rider_id,
					hub_id,
					awb_count: pickup_awb_count,
					otp_verifed_date: new Date(),
					type: 1, // for pickup
					signature_by_name : sign_name // to do check for name when feature is live for app
				};

				await pickupVerifyModel.savePickupVerifyOTP(insertObj);

			}
			await this.pickupComplete(pickup_request_no, route_request_assigned_id);

			const emailBody = {
				pickup_request_id,
				pickup_request_no,
				pickup_awb_count,
				name,
				signature_type,
				is_auth,
			};

			try {
				this.sendSellerEmail(emailBody);
			} catch (exception) {
				console.error(exception);
			}

			return true;
		} catch (exception) {
			throw new Error(exception.message || exception);
		}
	}

	async sendSellerEmail(emailBody) {
		try {
			let {
				pickup_request_id,
				pickup_request_no,
				pickup_awb_count,
				name,
				otp_contact_number,
				is_auth,
				signature_type,
			} = emailBody;

			let [wareHouseDetails] = await pickupVerifyModel.getWarehouseId(
				pickup_request_id
			);

			let {
				address,
				city,
				state,
				pincode,
				contact_number,
				sy_warehouse_id,
				hub_id,
				seller_id: sellerId,
			} = wareHouseDetails;

			let pickup_address = `${address}, ${city}, ${state}, ${pincode}`;

			const notificationName = 'pickup_complete';

			const [appNotificationData] = await getAppNotificationByName(
				notificationName
			);

			const {
				status,
				receiver,
				type: notificationType,
				unsubscribe,
				audience,
			} = appNotificationData ?? {};

			const sendNotificationInternalObj = {
				pickup_request_id,
				pickup_request_no,
				hub_id,
				sellerId,
				pickup_awb_count,
				pickup_address,
				name,
				contact_number,
				otp_contact_number,
				is_auth,
				signature_type
			};

			const sendNotificationExternalObj =
				{
					status,
					receiver,
					notificationType,
					unsubscribe,
					audience,
					sy_warehouse_id,
					...sendNotificationInternalObj,
				};

				if (audience === 1) {
					await this.sendNotificationInternal(sendNotificationInternalObj);
				  } else if (audience === 2) {
					await this.sendNotificationExternal(sendNotificationExternalObj);
				  } else if (audience === 3) {
					await Promise.all([
					  this.sendNotificationInternal(sendNotificationInternalObj),
					  this.sendNotificationExternal(sendNotificationExternalObj)
					]);
				  }
			return true;
		} catch (exception) {
			throw new Error(exception.message || exception);
		}
	}

	async sendNotificationInternal({
		pickup_request_id,
		pickup_request_no,
		hub_id,
		sellerId,
		pickup_awb_count,
		pickup_address,
		name,
		contact_number,
		otp_contact_number,
		is_auth,
		signature_type
	}) {
		try {
			const notificationName = 'pickup_complete_internal';

			const [appNotificationData] = await getAppNotificationByName(
				notificationName
			);

			const { status, receiver, type:notificationType, audience } =
				appNotificationData ?? {};

			if (!status) {
				return true;
			}

			await this.sendNotificationMethod({
				pickup_request_no,
				pickup_awb_count,
				pickup_address,
				name,
				otp_contact_number,
				is_auth,
				signature_type,
				contact_number,
				eventNameBy: notificationName,
				hub_id,
				sellerId,
				receiver,
				notificationType,
				audience,
				pickup_request_id
			});
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async sendNotificationExternal({
		status,
		receiver,
		notificationType,
		unsubscribe,
		pickup_request_id,
		pickup_request_no,
		hub_id,
		sellerId,
		sy_warehouse_id,
		pickup_awb_count,
		pickup_address,
		name,
		contact_number,
		audience,
		otp_contact_number,
		is_auth,
		signature_type
		
	}) {
		try {
			if (!status) {
				return true;
			}
			const notificationName = 'pickup_complete';

			await this.sendNotificationMethod({
				pickup_request_no,
				pickup_awb_count,
				pickup_address,
				name,
				otp_contact_number,
				is_auth,
				signature_type,
				contact_number,
				eventNameBy: notificationName,
				hub_id,
				sellerId,
				receiver,
				notificationType,
				audience,
				sy_warehouse_id,
				unsubscribe,
				pickup_request_id,
			});
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async sendNotificationMethod({
		pickup_request_no: pickupRequestNo,
		pickup_awb_count: pickupAwbCount,
		pickup_address: pickupAddress,
		name,
		otp_contact_number: otpContactNumber,
		is_auth: isAuth,
		signature_type: signatureType,
		contact_number: contactNumber,
		eventNameBy,
		hub_id,
		sellerId,
		receiver,
		notificationType,
		audience,
		sy_warehouse_id,
		unsubscribe,
		pickup_request_id: pickupRequestId,
	}) {
		try {
			let data = {};
			const emailType = [1, 4, 5, 7];
			const smsType = [2, 5, 6, 7];
			const whatsAppType = [3, 4, 6, 7];
			audience = audience.toString()

			if (
				(eventNameBy === 'pickup_complete'
					&& emailType.includes(notificationType) &&
					  (receiver.includes(0) || receiver.includes(hub_id)) &&
					  (audience.includes('2') || audience.includes('3')) &&
					  !unsubscribe.includes(sellerId))
					|| (emailType.includes(notificationType) && audience.includes('1'))
			) {
				let excelFilePath = await this.getPickupExport(
					pickupRequestId,
					pickupRequestNo
				);
				const username =
					eventNameBy === 'pickup_complete'
						? await getSellerEmail(sy_warehouse_id)
						: null;
				const emailContent = {
					pickup_request_no: pickupRequestNo,
					pickup_completed_on: dayjs(new Date()).format('DD-MM-YYYY'),
					pickup_awb_count: pickupAwbCount > 0 ? pickupAwbCount : 0,
					pickup_address: pickupAddress,
					rider_name: name,
					s3Link: excelFilePath,
				};

				if (otpContactNumber && isAuth != 0) {
					emailContent['OTP'] = 'OTP';
					emailContent['verifiedBy'] = isAuth == 1 ? `Yes` : `No`;
					emailContent['otp_verified_on'] =
						isAuth == 1 ? otpContactNumber : '-';
				}
				if (signatureType && isAuth != 0) {
					emailContent['SIGNATURE'] = 'SIGNATURE';
					emailContent['verifiedBy'] = isAuth == 1 ? `Yes` : `No`;
				}
				if (isAuth == 0) {
					emailContent['NOR_SIGN_NOR_OTP'] = 'NOR_SIGN_NOR_OTP';
				}

				const emailObj = {
					email: username,
					subject: `Pickup Completed | Shypmax`,
					email_content: emailContent,
				};

				data = { ...data, emailObj };
			}

			//TODO need to be change according to template once template approved
			const sms_content = {
				otp: '123456',
			};
			data = { ...data, sms_content, contact_number: contactNumber };
			if (
				((eventNameBy === 'pickup_complete'
					&& whatsAppType.includes(notificationType) &&
					  (receiver.includes(0) || receiver.includes(hub_id)) &&
					  (audience.includes('2') || audience.includes('3')) &&
					  !unsubscribe.includes(sellerId)))
					|| (whatsAppType.includes(notificationType) && audience.includes('1'))
			) {
				const whatsAppObj = [
					{
						type: 'text',
						text: pickupRequestNo,
					},
					{
						type: 'text',
						text: dayjs(new Date()).format('DD-MM-YYYY'),
					},
					{
						type: 'text',
						text: name,
					},
					{
						type: 'text',
						text: pickupAwbCount > 0 ? pickupAwbCount : 0,
					},
					{
						type: 'text',
						text: pickupAddress,
					},
				];
				data = {
					...data,
					whatsAppObj,
					whatsapp_contact_number: contactNumber,
				};
			}
			data.eventName = eventNameBy;
			await sendNotification(data);
			return true;
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async getPickupExport(pickupRequestId, pickupRequestNo) {
		try {
			const queryString = await pickupVerifyModel.getPickupSummaryData(
				pickupRequestId
			);

			const connection = await readDB.getConnection();

			const csv = new CsvWriter();

			let tempPath = `${os.tmpdir()}/`;

			if (!fs.existsSync(tempPath + `shyptrack/pickup_complete_file`)) {
				fs.mkdirSync(tempPath + `shyptrack/pickup_complete_file`);
			}

			const fileName = `shyptrack/pickup_complete_file/${pickupRequestNo}_${dayjs(
				new Date()
			).format('DD-MM-YYYY')}-${Date.now()}.csv`;

			const filePath = `${os.tmpdir()}/${fileName}`;
			await csv.initialize({ schema, filePath });

			let pickup_complete_arr = [];

			const addRows = async (data) => {
				data = data.map((i) => {
					i.awb = i?.awb ? i?.awb : '-';
					i.shypmax_id = i?.shypmax_id ? i?.shypmax_id : '-';
					i.order_number = i?.order_number ? i?.order_number : '-';

					return i;
				});

				for (let i of data) {
					csv.writeRow(i);
				}
			};
			const promise = new Promise((resolve, reject) => {
				connection.connection
					.query(queryString)
					.on('error', (err) => {
						console.error(__line, err);
						connection.release();
						reject(err);
					})
					.on('result', async (i) => {
						pickup_complete_arr.push(i);

						if (pickup_complete_arr.length < BATCH_SIZE) return;

						connection.pause();

						await addRows(pickup_complete_arr, csv);

						pickup_complete_arr = [];

						connection.resume();
					})
					.on('end', async () => {
						connection.release();

						if (pickup_complete_arr.length > 0) {
							await addRows(pickup_complete_arr, csv);
						}

						await csv.closeFile();
						resolve();
					});
			});

			await promise;
			const S3 = new s3Module();
			const key = `downloads/pickup-complete/${pickupRequestNo}_${dayjs(
				new Date()
			).format('DD-MM-YYYY')}-${Date.now()}.csv`;
			const upload = await S3.uploadToS3('', key, filePath);
			const signedURL = await S3.getFilePath(key, 1440);

			try {
				if (fs.existsSync(tempPath + `shyptrack/pickup_complete_file`)) {
					fs.rmdirSync(tempPath + `shyptrack/pickup_complete_file`, {
						// deleting downloaded pickup complete
						recursive: true,
					});
				}
			} catch (exception) {
				console.error(__line, exception);
			}

			return signedURL;
		} catch (exception) {
			console.error(__line, exception);
			throw new Error(exception.message || exception);
		}
	}

	async generateHeaders(sy_warehouse_id) {
		try {
			const timestamp = +new Date();

			let stringToString = `key:${SELLER_DATA.PUBLIC_KEY}id:${SELLER_DATA.APP_ID}:timestamp:${timestamp}`;

			let hash = crypto
				.createHmac('sha256', SELLER_DATA.SECRET_KEY)
				.update(stringToString)
				.digest('base64')
				.toString();

			const { BASE_URL, SELLER_DATA_ENDPOINT } = SELLER_DATA;

			const url = BASE_URL + SELLER_DATA_ENDPOINT;
			let config = {
				method: 'GET',
				url: `${url}?sy_warehouse_id=${sy_warehouse_id}`,
				headers: {
					'Content-type': 'application/json',
					'authorization': hash,
					'x-appid': SELLER_DATA.APP_ID,
					'x-timestamp': timestamp,
				},
			};

			return config;
		} catch (exception) {
			console.error(exception);
			throw new Error(exception.message || exception);
		}
	}

	async pickupComplete(pickup_request_no, existing_route_request_assigned_id) {
		try {
			const update_data = { status_date: new Date() }; //status 4 for partial pickup

			const pickup_trip_data = await routeAssignmentModel.getPickupTripDataById(
				existing_route_request_assigned_id
			);
			if (!pickup_trip_data.length) {
				throw new Error('Pickup trip not found');
			}

			const pending_orders = await ordersModel.getOrdersByTripId(
				existing_route_request_assigned_id,
				[3]
			);

			const pickup_request_data =
				await routeAssignmentModel.getPickupRequestDetailsByPRNo(
					pickup_request_no
				);

			if (!pickup_request_data.length) {
				throw new Error('Pickup request not found.');
			}

			const pickup_req = pickup_request_data[0];

			let { pickup_location_id, hub_id } = pickup_req;

			const pending_order_count = pending_orders.length;

			let pickup_req_state = 4;

			let reassign_pickup_request_id = null;

			if (pending_order_count > 0) {
				pickup_req_state = 4; //for partial pickup
			} else {
				pickup_req_state = 2; //for complete pickup
			}

			update_data.state = pickup_req_state;
			update_data.pending_order_count = pending_order_count;

			let result = await routeAssignmentModel.pickupComplete(
				update_data,
				pickup_request_no
			);

			if (pending_order_count > 0) {
				reassign_pickup_request_id =
					await pickupRequestModule.updateOrderAndCreatePickupRequest({
						ordersForEvent: pending_orders,
						hubId: hub_id,
						pickupLocationId: pickup_location_id,
						pickupRequestNo: pickup_request_no,
						existingRouteRequestAssignedId: existing_route_request_assigned_id,
						orderStatus: 17,
					});
			}

			await routeAssignmentModel.updateRouteRequest(
				{ status: 1, reassign_pickup_request_id },
				existing_route_request_assigned_id
			);

			return { data: result };
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}
}

module.exports = PickupVerify;
