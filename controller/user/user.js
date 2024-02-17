'use strict';

const {
  checkOldPassword,
  updateUser,
  getUserDetailsById,
  saveUser,
  getUserByPhone,
  updateLocationInfoSetting,
} = require('../../models/users');
const S3_MODULE = require('../../modules/s3');
const HASHER = require('../../modules/hasher');
const UPLOAD_DOCUMENT = require('../../modules/uploadDocument');
const authModel = require('../../models/authToken');
const userHubModel = require('../../models/user_hub');
const jwt = require('jsonwebtoken');

class User {
  async createUser(body, userid) {
    try {
      let {
        profile_picture_file,
        profile_picture_type,
        contact_number,
        password,
        name,
        address,
        role_id,
        app_access,
        vehicle_number,
        email,
        hub_id,
        secure_package,
        vehicle_type_id,
        zone_id,
        two_fa_method
      } = body;

      // role rider can be assigned only single hub
      if (role_id == 2 && hub_id.length != 1) {
        throw Error('Rider cannot be assigned to multiple hubs');
      }

      const user = await getUserByPhone(contact_number);

      if (user.length) {
        throw new Error(
          'Mobile Number is already registered with other account, please try again with different mobile Number',
        );
      }

      const data = {
        name,
        email,
        contact_number,
        address,
        role_id,
        password,
        app_access,
        vehicle_number,
        secure_package,
        fav_setting: '{}',
        vehicle_type_id,
        zone_id,
        two_fa_method
      };

      data.password = await HASHER.encode(password);

      const user_id = await saveUser(data);
      if (hub_id) {
        await userHubModel.saveUserHubMapping(user_id, hub_id);
      }

      if (profile_picture_file && profile_picture_type) {
        const upload_data = {
          file_name: profile_picture_file,
          file_type: profile_picture_type,
          key: `users/${user_id}/profile_image/profile_image.${profile_picture_type}`,
        };

        await UPLOAD_DOCUMENT.uploadDocument(upload_data);
      }
      return true;
    } catch (exception) {
      console.error(exception);
      throw exception;
    }
  }

  async changePass(user_id, data) {
    try {
      let { current_password, new_password, confirm_password } = data;

      if (new_password !== confirm_password)
        throw new Error('New Password and confirm Password does not match');

      if (current_password === new_password)
        throw new Error('New Password same as your Current Password');

      const old_password = await checkOldPassword(user_id);

      const verify = await HASHER.verify(
        current_password,
        old_password?.password,
      );

      if (verify === false) {
        throw new Error(
          'Entered Password do not match with your Current Password ',
        );
      }

      const hash_new_password = await HASHER.encode(new_password);
      const update_Pass = await updateUser(user_id, {
        password: hash_new_password,
      });

      if (update_Pass) {
        return 'password Updated successfully';
      } else {
        throw new Error('Error while updating password');
      }
    } catch (exception) {
      console.error(exception);
      throw exception;
    }
  }

  async appLogout(access_token) {
    try {
      const token = jwt.decode(access_token);
      const { rid, source } = token;
      //1 - Web Login, 2 - Mobile app login
      //in case of web login change tokenStaus
      if (Number(source) === 1) {
        await authModel.updateAuthToken(rid, { session_status: 2 });
      } else {
        await authModel.deleteToken(rid);
      }
    } catch (exception) {
      console.error(exception);
      throw exception;
    }
  }

  async getUserDetails(id) {
    try {
      let result = await getUserDetailsById(id);
      if (!result) throw Error('User not found');
      const userHubDetails = await userHubModel.getHubDetailsBasedOnUser(id);
      result.hub_id = userHubDetails.map((i) => i.hub_id);
      let hub_city = userHubDetails.map((i) => i.city);
      hub_city = new Set(hub_city);
      result.hub_city = [...hub_city];

      const S3 = new S3_MODULE();
      const key = await S3.findObject(
        `users/${id}/profile_image/profile_image`,
      ).catch((e) => console.log(e));

      result.profile_image = key ? await S3.getFilePath(key) : '';

      return result;
    } catch (exception) {
      console.error(exception);
      throw exception;
    }
  }

  async editUser(id, body) {
    try {
      const key_to_update = [
        'name',
        'email',
        'address',
        'vehicle_number',
        'role_id',
        'status',
        'app_access',
        'contact_number',
        'secure_package',
        'vehicle_type_id',
        'zone_id',
        'two_fa_method'
      ];
      const data = {};

      for (const key in body) {
        if (Object.hasOwnProperty.call(body, key)) {
          if (key_to_update.includes(key)) data[key] = body[key];
        }
      }

      if (!Object.keys(data).length) {
        throw new Error('No data found for update');
      }

      const user = await getUserByPhone(body.contact_number);

      if (user.length) {
        if (user[0].id != id) {
          throw new Error(
            'Mobile Number is already registered with other account, please try again with different mobile Number',
          );
        }
      }

      const result = await updateUser(id, data);

      if (body?.hub_id && body?.hub_id?.length) {
        await userHubModel.deleteUserHubMapping(id);
        await userHubModel.saveUserHubMapping(id, body.hub_id);
      }

      if (body?.profile_picture_file && body?.profile_picture_type) {
        const upload_data = {
          file_name: body.profile_picture_file,
          file_type: body.profile_picture_type,
          key: `users/${id}/profile_image/profile_image.${body.profile_picture_type}`,
        };

        await UPLOAD_DOCUMENT.uploadDocument(upload_data);
      }

      if (result) {
        if (user[0]?.role_id != body?.role_id) {
          try {
            await authModel.updateTokenStatus([id], 2);
          } catch (exception) {
            console.error(exception);
            throw new Error('User updated. Please logout and login again ');
          }
        }

        return true;
      } else {
        throw new Error('Error While Updating User');
      }
    } catch (exception) {
      console.error(exception);
      throw exception;
    }
  }

  async getToken(accessToken) {
    //if token not provided then logout user
    if (!accessToken) {
      //session_status 2 means forecfully logout
      return { session_status: 2 };
    }
    try {
      const token = jwt.decode(accessToken);
      const [rows] = await authModel.getRefreshToken(token.rid);
      if (!rows) {
        return { session_status: 2 };
      }

      return { session_status: rows.session_status };
    } catch (exception) {
      console.error(exception);
      throw exception;
    }
  }

  async forceLogout(user_id, app_access) {
    try {
      // app_access- 1: hub web app, 2: rider mobile app
      // session_status- 0 - Default, 1 - Refresh, 2- logout
      const sessionStatus = 2;

      if (app_access === 1) {
        const result = await authModel.updateTokenStatus(
          user_id,
          sessionStatus,
        );
        if (!result.affectedRows) {
          // If the update operation did not affect any rows
          throw new Error('User is currently not logged-in');
        }
      } else if (app_access === 2) {
        const result = await authModel.deleteTokenByUserId(user_id);
        if (!result.affectedRows) {
          // If the delete operation did not affect any rows
          throw new Error('Rider is currently not logged-in');
        }
      }
    } catch (exception) {
      console.error(exception);
      throw exception;
    }
  }
}

module.exports = User;
