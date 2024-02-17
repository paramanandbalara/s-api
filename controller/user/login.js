'use strict';

const md5 = require('md5');
const { getUserByPhone } = require('../../models/users');
const AUTH = require('../../../shyptrack-static/auth.json');
const UTIL_CONTROLLER = require('../util');
const authModel = require('../../models/authToken');
const { sendOtp } = require('../../modules/sendOtp');
const HASHER = require('../../modules/hasher');
const ROUTES_MODEL = require('../../models/routes');
const OTP_GEN = require('../../modules/gererateOtp');
const { getHubIdByUser } = require('../../modules/userHub');
const userModel = require('../../models/users');
const { checkUserIsNearByHub } = require('../../modules/geoFence');
const { authenticator } = require('otplib');

const {
	setting: { app_setting_access_user: appSettingAccessUser = [] } = {},
} = require('../../../shyptrack-static/stconfig.json');
const { use } = require('../../routes/users/userAuth');
class Login {
	async userLogin(req, res) {
		try {
			const source = Number(req.header('source'));
			const {
				contact_number: contactNumber,
				password,
				ip,
				lat,
				lng,
				logoutExistingLogin = false,
				googleAuthCode,
				authOTP,
			} = req.body;

			const otpToken = req.header('otp_token');
			let secretKey = req.header('secretkey');
            secretKey = secretKey === 'null' ? null : secretKey;

			if (!contactNumber) {
				throw new Error('Please enter a contact number');
			}

			const userInfo = await this.getUserDetails(contactNumber);
			const {
				id: userId,
				role_id: roleId,
				password: userPassword,
				app_access: appAccess,
			} = userInfo;
			//1: hub web app, 2: rider mobile app app access
			if (appAccess !== source) {
				throw new Error('Not authorized on this device');
			}

			return source === 1
				? await this.validateUserForWeb({
						password,
						userPassword,
						logoutExistingLogin,
						userId,
						userInfo,
						source,
						ip,
						lat,
						lng,
						roleId,
						googleAuthCode,
						contactNumber,
						authOTP,
						otpToken,
						secretKey,
						res,
				  })
				: await this.validateUserForMobile({ contactNumber, res });
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async validateUserForWeb({
		password,
		userPassword,
		logoutExistingLogin,
		userId,
		userInfo,
		source,
		ip,
		lat,
		lng,
		roleId,
		googleAuthCode,
		contactNumber,
		otpToken,
		secretKey,
		res,
		authOTP
	}) {
		try {
			if (!password) {
				throw new Error('Please enter a password');
			}
			const isPasswordValid = await HASHER.verify(password, userPassword);

			if (!isPasswordValid) {
				throw new Error('Invalid contact number or password');
			}

			const { two_fa_method: twoFaMethod } = userInfo;

			if (twoFaMethod === Number(1)) {
				const validOtpAuth = await this.validateOtpAuth({
					authOTP,
					otpToken,
					contactNumber,
					res,
				});
				if (validOtpAuth) return validOtpAuth;
			}

			if (twoFaMethod === Number(2)) {
				const validateGoogleAuth = await this.validateGoogleAuth({
					userInfo,
					googleAuthCode,
					userId,
					contactNumber,
					secretKey,
					res,
				});
				if (validateGoogleAuth) return validateGoogleAuth;
			}

			if (logoutExistingLogin) {
				await authModel.updateTokenStatus([userId], 2); // Update session status to 2
			}

			const [isUserAlreadyLoggedIn] = !logoutExistingLogin
				? await authModel.checkUserAlreadyLoggedIn(userId)
				: [];
			if (isUserAlreadyLoggedIn) {
				return {
					success: true,
					message: 'This user is already logged in on another device',
					isAlreadyLoggedIn: true,
				};
			}

			const checkLocationEnabledForLogin = await checkUserIsNearByHub(
				userId,
				lat,
				lng
			);
			if (!checkLocationEnabledForLogin) {
				return {
					success: true,
					message: 'Please enable location on your device/browser to proceed',
					islocationRequired: true,
				};
			}

			const authorizedUrls = await this.getAuthorizedUrls(roleId, userId);
			const token = await this.generateToken({
				user_info: userInfo,
				source,
				ip,
				lat,
				lng,
			});

			return {
				success: true,
				message: 'Logged in',
				access_token: token,
				authorized_urls: authorizedUrls,
				isAlreadyLoggedIn: false,
				islocationRequired: false,
			};
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	// Function to validate the OTP provided by the user
	async validateOtpAuth({
		authOTP, // User-provided OTP to be validated
		otpToken, // Encoded OTP token received from the client
		contactNumber, // User's contact number associated with the OTP
		res, // Express response object (to be used later)
	}) {
		if (authOTP) {
			// If the user has provided an OTP for verification
			const verifyToken = await HASHER.verify(authOTP, otpToken);
			if (!verifyToken) {
				// If the provided OTP is not valid
				throw new Error('Please enter correct OTP');
			}
		} else {
			// If the user has not provided an OTP (OTP generation flow)
			const otp = await OTP_GEN.generateOtp(); // Generate a new OTP
			await sendOtp(otp, contactNumber, 'shyptrack_otp_login'); // Send the OTP to the user's contact number
			const otp_token = await HASHER.encode(otp?.toString()); // Encode the OTP for storage
			res.append('otp_token', otp_token); // Append the encoded OTP to the response header
			return { success: true, isOtp: true, message : 'OTP sent successfully' }; // Return a flag indicating OTP status
		}
	}

	// Function to validate the Google Authenticator code provided by the user
	async validateGoogleAuth({
		userInfo, // User information, including two-factor authentication secret
		googleAuthCode, // Google Authenticator code provided by the user for verification
		userId, // User ID of the user performing the validation
		secretKey, // The secret key for two-factor authentication (optional)
		res, // Express response object (to be used later)
	}) {
		let { two_fa_secret: twoFaSecret, name } = userInfo; // Extract the two-factor authentication secret and user's name

		if (googleAuthCode) {
			// If the user provides a Google Authenticator code
			const verified = authenticator.check(
				googleAuthCode,
				twoFaSecret || secretKey
			);
			if (!verified) {
				// If the provided Google Authenticator code is not valid
				throw new Error('Verification failed');
			}
			if (secretKey) {
				// If a secret key is provided, update the user's two-factor authentication secret in the database
				await userModel.updateUser(userId, { two_fa_secret: secretKey });
			}
		} else {
			// If the user does not provide a Google Authenticator code (2FA setup flow)
			if (twoFaSecret == null) {
				// If the two-factor authentication secret is not already set
				const secretKey = authenticator.generateSecret(); // Generate a new secret key for two-factor authentication
				const otpauthUrl = authenticator.keyuri(name, 'Shyptrack', secretKey); // Generate the OTP authentication URL
				res.append('secret_key', secretKey); // Append the secret key to the response header

				return {
					success: true,
					otpAuthUrl: otpauthUrl, // Return the OTP authentication URL for QR code setup
					isShowQR: true, // Flag to indicate that the QR code should be shown on the client-side
					isFirstTime: true, // Flag to indicate that it's the first time the user is setting up 2FA
					message: 'QR code generated successfully',
				};
			} else {
				// If the two-factor authentication secret is already set
				return {
					success: true,
					isShowGoogleCode: true, // Flag to indicate that the Google Authenticator code input should be shown on the client-side
					isFirstTime: false, // Flag to indicate that it's not the first time the user is setting up 2FA
					message: 'QR code already generated please contact support',
				};
			}
		}
	}

	async validateUserForMobile({ contactNumber, res }) {
		try {
			const otp = await this.generateOtp();
			await sendOtp(otp, contactNumber, 'shyptrack_otp_login');

			const otpToken = md5(Number(otp));
			res.append('otp_token', otpToken);

			return { success: true, message: 'OTP sent' };
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async getUserDetails(contactNumber) {
		try {
			const [userInfo] = await getUserByPhone(contactNumber);
			if (!userInfo) {
				throw new Error('User not found');
			}

			if (!userInfo.status) {
				throw new Error('Your account is disabled. Please contact support.');
			}

			return userInfo;
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async getAuthorizedUrls(role_id, userId) {
		try {
			const routes = await ROUTES_MODEL.getParticularRoutesAuth(role_id);

			return routes
				.map(({ route }) => {
					if (
						route.startsWith('/app-setting') &&
						!appSettingAccessUser.includes(userId)
					) {
						return null; // Unauthorized user for app-setting route
					}
					return route; // Authorized user or other routes accessible by all users
				})
				.filter(Boolean); // Filter out null values from the array
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async generateToken({
		user_info,
		source,
		ip = null,
		hub_details = {},
		lat = null,
		lng = null,
	}) {
		try {
			const { REFRESH_TOKEN_EXPIRE_TIME, AUTH_TOKEN_EXPIRE_TIME } = AUTH;
			const { AUTH_REFRESH_SECRECT_KEY, AUTH_SECRET_KEY } = process.env;

			const payload = {
				source: source,
				user_id: user_info.id,
				user_name: user_info.name,
				role: user_info.role_id,
				city: hub_details?.city,
				code: hub_details?.code,
				state: hub_details?.state,
			};

			const UTIL = new UTIL_CONTROLLER();
			const refresh_token = await UTIL.generateToken(
				payload,
				AUTH_REFRESH_SECRECT_KEY,
				REFRESH_TOKEN_EXPIRE_TIME
			);

			const token_object = {
				user_id: user_info.id,
				refresh_token,
				source,
				ip,
				lat: lat ? lat : null,
				lng: lng ? lng : null,
			};

			const refresh_id = await authModel.insertToken(token_object);
			payload.rid = refresh_id;

			const token = await UTIL.generateToken(
				payload,
				AUTH_SECRET_KEY,
				AUTH_TOKEN_EXPIRE_TIME
			);
			let unused = await authModel.saveAccessToken(refresh_id, token);

			return token;
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}

	async generateOtp() {
		const minRange = 100000;
		const maxRange = 999999;
		const otp =
			Math.floor(Math.random() * (maxRange - minRange + 1)) + minRange;
		return otp;
	}

	async verifyOtp(req, res) {
		try {
			const { contact_number, otp } = req.body;
			const { otp_token, source, ip } = req.headers;
			const encryptedOtp = md5(Number(otp));

			if (otp_token !== encryptedOtp) {
				throw new Error('Please enter correct OTP');
			}
			const user_info = await this.getUserDetails(contact_number);

			const hub_details = await getHubIdByUser(user_info.id);

			const token = await this.generateToken({
				user_info,
				source,
				ip,
				hub_details,
			});

			return { success: true, message: `Logged In`, access_token: token };
		} catch (exception) {
			console.error(exception);
			throw exception;
		}
	}
}

module.exports = Login;
