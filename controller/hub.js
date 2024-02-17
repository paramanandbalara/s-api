'use strict';

const { getHubDetailsBasedOnUser } = require('../models/user_hub');
const {
  getHubDetailsByPincodeAndStatus,
} = require('../models/hub_pincode_mapping');
const xlsJSON = require('../modules/xlsJSON');
const path = require('path');
const CsvWriter = require('../modules/csvWriter');
const os = require('os');
const dayjs = require('dayjs');
const S3_MODULE = require('../modules/s3');
const hubPincodeModel = require('../models/hub_pincode_mapping');
const hubModel = require('../models/hub');
const { getAndUpdateLatLng } = require('../modules/locationService');

const schema = [
  { header: 'Pincode', key: 'pincode' },
  { header: 'Hub Code', key: 'code' },
];

const BATCH_SIZE = 100;

class Hub {
  static DEFAULT_PAGE = 1;
  static DEFAULT_LIMIT = 25;

  async createHub(body) {
    try {
      const rows = await hubModel.getHubByCode(body.code);

      const {
        code,
        name,
        city,
        address,
        contact_name,
        contact_number = null,
        contact_email,
        gateway_code = null,
        serviceable_pincodes,
        state,
        type = 0,
        cutoff_time,
        status,
        pincode,
        secure_pickup = 0
      } = body;

      if (rows.length) {
        throw new Error('Hub Code already registered');
      }

      let pincodes =
        serviceable_pincodes?.split(',').map((element) => {
          if (element.trim().length != 6 || isNaN(Number(element))) {
            throw new Error(`Please enter correct pincode ${element}`);
          }
          return Number(element.trim());
        }) || [];

      if (type != 1 && !pincodes.length) {
        // if other then gateway then check pincode is required
        throw new Error('Please add atleast one pincode');
      }

      try {
        const hub = await hubModel.saveHub({
          code,
          name,
          city,
          address,
          contact_name,
          contact_number,
          contact_email,
          gateway_code,
          state,
          type,
          cutoff_time,
          status,
          pincode,
          secure_pickup
        });
        const hubId = hub.insertId;

        const fullAddress = [address, city, pincode].join(',');
        if (fullAddress) {
          getAndUpdateLatLng(fullAddress, 'hubDetails', hubId);
        }

        let msg = ``;

        if (pincodes.length) {
          const duplicate_pincodes = await hubModel.getDuplicatePincodes(
            pincodes,
          );

          if (duplicate_pincodes.length) {
            const dup_pincode = duplicate_pincodes.map(
              (element) => element.pincode,
            );

            pincodes = pincodes.filter((item) => dup_pincode.indexOf(item) < 0);

            msg = `but These pincodes are already registered in System(${dup_pincode})`;
          }

          if (!pincodes.length) {
            throw new Error(`All pincode are already registered in system`);
          }

          const serviceable_pincodes_arr = pincodes.map((pincode) => [
            hubId,
            city,
            pincode,
          ]);

          const save_pincode = await hubModel.saveServiceablePincodes(
            serviceable_pincodes_arr,
          );
        }
        return `Hub created successfully ${msg}`;
      } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception);
      }
    } catch (exception) {
      throw new Error(exception.message || exception);
    }
  }

  async getHubsListBasedOnUserId(
    page_no,
    offset_row,
    is_pagination = `true`,
    user_id,
    hub_code,
    hub_city,
  ) {
    try {
      let hasNext = false,
        hasPrev = false;
      let page = parseInt(page_no ?? Hub.DEFAULT_PAGE);
      let limit = parseInt(offset_row ?? Hub.DEFAULT_LIMIT);

      //Page no. starts from 1
      let offset = (page - 1) * limit;

      let rows = await hubModel.getAllHubs(
        offset,
        limit + 1,
        is_pagination,
        '',
        '',
        hub_code,
        hub_city,
      );

      if (is_pagination == `true`) {
        if (rows.length == limit + 1) hasNext = true;

        if (page > 1) hasPrev = true;

        rows = rows.slice(0, limit);
      }
      return { data: rows, hasNext, hasPrev };
    } catch (exception) {
      throw new Error(exception.message || exception);
    }
  }

  async getCityWiseHubs(city) {
    try {
      return hubModel.getCityWiseHubs(city);
    } catch (exception) {
      throw new Error(exception.message || exception);
    }
  }

  async getHubUsers(
    page_no,
    offset_row,
    hub_code,
    hub_city,
    role_id,
    contact_no,
  ) {
    try {
      let hasNext = false,
        hasPrev = false;
      let page = parseInt(page_no ?? Hub.DEFAULT_PAGE);
      let limit = parseInt(offset_row ?? Hub.DEFAULT_LIMIT);

      //Page no. starts from 1
      let offset = (page - 1) * limit;

      let rows = await hubModel.getAllHubUsers(
        offset,
        limit + 1,
        hub_code,
        hub_city,
        role_id,
        contact_no,
      );
      if (rows.length == limit + 1) hasNext = true;

      if (page > 1) hasPrev = true;

      rows = rows.slice(0, limit);
      return { data: rows, hasNext, hasPrev };
    } catch (exception) {
      throw new Error(exception.message || exception);
    }
  }

  async editHub(hubId, body) {
    try {
      const { code, serviceable_pincodes: serviceablePincodes, city } = body;
      const keyForUpdate = [
        'code',
        'name',
        'city',
        'address',
        'contact_name',
        'contact_number',
        'contact_email',
        'gateway_code',
        'status',
        'state',
        'cutoff_time',
        'pincode',
        'secure_pickup'
      ];
      const hubDataToUpdate = {};
      if (code) {
        const existingHub = await hubModel.getHubByCode(code);
        if (existingHub.length) {
          if (existingHub[0].id != hubId) {
            throw new Error('Hub Code already registered');
          }
        }
      }
      for (const key of keyForUpdate) {
        if (key in body) {
          hubDataToUpdate[key] = body[key];
        }
      }
      if (Object.keys(hubDataToUpdate).length === 0) {
        throw new Error('No data found for update');
      }

      const {
        address: existingHubAddress,
        city: existingHubCity,
        pincode: existingHubPincode,
      } = await hubModel.getHubDetailsById(hubId);

      if (serviceablePincodes !== undefined) {
        await this.updatePincodes(hubId, city, serviceablePincodes);
      }
      await hubModel.editHubDetails(hubId, hubDataToUpdate);

      const existingFullAddress = [
        existingHubAddress,
        existingHubCity,
        existingHubPincode,
      ].join(',');
      const fullAddress = [body['address'], body['city'], body['pincode']].join(
        ',',
      );

      if (fullAddress && fullAddress !== existingFullAddress) {
        getAndUpdateLatLng(fullAddress, 'hubDetails', hubId);
      }

      return 'Hub details have been updated.';
    } catch (exception) {
      console.error(__line, exception);
      throw exception;
    }
  }

  async updatePincodes(hubId, city, serviceablePincodes) {
    try {
      serviceablePincodes = Array.isArray(serviceablePincodes)
        ? serviceablePincodes
        : typeof serviceablePincodes === 'string' && serviceablePincodes.length
        ? serviceablePincodes.split(',')
        : [];

      const pincodesArr =
        serviceablePincodes.map((element) => {
          const trimmedPincode = element.toString().trim();
          const numPincode = Number(trimmedPincode);
          if (trimmedPincode.length !== 6 || isNaN(numPincode)) {
            throw new Error(
              `Please enter a correct pincode: ${trimmedPincode}`,
            );
          }
          return numPincode;
        }) || [];

      const serviceablePincodesData = pincodesArr.length
        ? await hubPincodeModel.getServiciableDataByPincodes(pincodesArr)
        : [];
      const pincodesFromDifferentHub = serviceablePincodesData.reduce(
        (accumulator, { pincode, code: hubCode, hub_id: existingHubId }) => {
          if (
            pincodesArr.includes(pincode) &&
            Number(existingHubId) !== Number(hubId)
          ) {
            accumulator.push({ pincode, hubCode });
          }
          return accumulator;
        },
        [],
      );
      if (pincodesFromDifferentHub.length) {
        const errorMsg = pincodesFromDifferentHub
          .map(
            ({ pincode, hubCode }) =>
              `(Pincode: ${pincode}, HubCode: ${hubCode})`,
          )
          .join(', ');
        throw new Error(
          `These pincodes are already registered in the system: ${errorMsg}`,
        );
      }
      const serviceablePincodesArr = pincodesArr.map((pincode) => [
        hubId,
        pincode,
        city,
      ]);
      const fieldNames = ['hub_id', 'pincode', 'city'];
      await hubModel.deletePincodesByHubId(hubId);
      if (serviceablePincodesArr.length) {
        await hubModel.savePincodes(fieldNames, serviceablePincodesArr);
      }
    } catch (error) {
      console.error(__line, error);
      throw error;
    }
  }

  async getHubDetails(hub_id) {
    try {
      const hub_details = await hubModel.getHubDetailsById(hub_id);
      const serviceable_pincodes = await hubModel.getHubsServiceablePincodes(
        hub_id,
      );

      hub_details.serviceable_pincodes = serviceable_pincodes
        .map((element) => element.pincode)
        .join(',');

      return hub_details;
    } catch (exception) {
      throw new Error(exception.message || exception);
    }
  }

  async getCities() {
    try {
      return hubModel.getCities();
    } catch (exception) {
      throw new Error(exception.message || exception);
    }
  }

  async checkPincodeServiceabilty(type, pincode) {
    try {
      let hub_status = [];

      if (type && type == 2) {
        //for delivery
        hub_status = [2, 3];
      } else {
        //for pickup
        hub_status = [1, 2];
      }

      const DATA = await getHubDetailsByPincodeAndStatus(pincode, hub_status);
      if (DATA.length == 0) throw `${pincode} is not serviceable`;
      return DATA[0];
    } catch (error) {
      throw new Error(error);
    }
  }

  async getGatwayDetails(user_id) {
    try {
      let hub_details = await getHubDetailsBasedOnUser(user_id);
      if (!hub_details.length) {
        throw new Error('Hub details not found');
      }

      hub_details = hub_details.map((x) => x.gateway_code);

      const gateway_details = await hubModel.getHubByCode(hub_details);

      return gateway_details;
    } catch (exception) {
      console.error(exception);
      throw new Error(exception.message || exception);
    }
  }

  async getGatwayList() {
    try {
      return hubModel.getAllHubs('', '', '', true);
    } catch (exception) {
      console.error(exception);
      throw new Error(exception.message || exception);
    }
  }

  async getconnectionList() {
    try {
      return hubModel.getAllHubs('', '', '', '', true);
    } catch (exception) {
      console.error(exception);
      throw new Error(exception.message || exception);
    }
  }

  async getPincodeLocation(user_id) {
    try {
      let result = await hubModel.getPincodeLocation(user_id);

      let pincode_arr = [];

      result.forEach((element) => {
        pincode_arr.push(element.pincode);
      });

      return pincode_arr;
    } catch (exception) {
      console.error(exception);
    }
  }

  async getAllHubsList(allHubs) {
    try {
      return hubModel.getAllHubsList(allHubs);
    } catch (exception) {
      console.error(__line, exception);
      throw exception;
    }
  }

  async getHubWiseRiderList(hubIds) {
    try {
      if (!hubIds) {
        throw new Error('Please select hub');
      }
      hubIds = hubIds.split(',');
      return hubModel.getHubWiseRiderList(hubIds);
    } catch (exception) {
      console.error(exception);
      throw exception;
    }
  }

  async uploadPincodeList(hubId, file) {
    try {
      const uploadExt = path.extname(file.originalname);
      if (
        uploadExt === '.xlsx' ||
        uploadExt === '.xls' ||
        uploadExt === '.csv'
      ) {
        const pincodeListArr = await xlsJSON(file.path);

        if (!pincodeListArr.length) {
          throw new Error('No pincode found in uploaded file');
        }

        const fileKeys = Object.keys(pincodeListArr[0]);
        const expectedKeys = ['pincode', 'hubcode'];

        const absent = expectedKeys.filter((e) => !fileKeys.includes(e));
        if (absent.length) {
          throw new Error(
            'You have uploaded the wrong file format. Please download template (sample) and try again.',
          );
        }
        await this.pincodeValidation(pincodeListArr, hubId);
        return true;
      }
    } catch (exception) {
      console.error(exception);
      throw exception;
    }
  }

  async pincodeValidation(pincodeList, hubId) {
    try {
      const {
        id: dbHubId,
        city: dbHubCity,
        code: dbHubCode,
      } = await hubModel.getHubDetailsById(hubId);

      const { hubCodeSet, pincodeSet, duplicatePincodes, wrongHubCode } =
        pincodeList.reduce(
          (accumulator, { hubcode, pincode }) => {
            if (accumulator.pincodeSet.has(pincode)) {
              accumulator.duplicatePincodes.push(pincode);
            } else {
              accumulator.pincodeSet.add(pincode);
            }
            accumulator.hubCodeSet.add(hubcode);
            if (hubcode !== dbHubCode) {
              accumulator.wrongHubCode.push(hubcode);
            }
            return accumulator;
          },
          {
            hubCodeSet: new Set(),
            pincodeSet: new Set(),
            duplicatePincodes: [],
            wrongHubCode: [],
          },
        );

      const pincodeArr = [...pincodeSet];
      const hubCodeArr = [...hubCodeSet];

      const errorMsg = this.validateMsgsCondition({
        hubCodeArr,
        pincodeArr,
        hubCodeSet,
        duplicatePincodes,
        dbHubCode,
        wrongHubCode,
      });

      if (errorMsg) {
        throw new Error(errorMsg);
      }

      await this.updatePincodes(dbHubId, dbHubCity, pincodeArr);
    } catch (exception) {
      console.error(exception);
      throw exception;
    }
  }

  validateMsgsCondition({
    hubCodeArr,
    pincodeArr,
    hubCodeSet,
    duplicatePincodes,
    dbHubCode,
    wrongHubCode,
  }) {
    try {
      if (hubCodeArr.includes('')) {
        return 'Please enter hubcode(s)';
      }
      if (pincodeArr.includes('')) {
        return 'Please enter pincode(s)';
      }
      if (hubCodeSet.size > 1) {
        const uniqueHubcodes = [...new Set(wrongHubCode)];
        return `More than one hubcodes are in the sheet: ${uniqueHubcodes.join(
          ', ',
        )}`;
      }
      if (duplicatePincodes.length) {
        const uniquePincodes = [...new Set(duplicatePincodes)];
        return `Duplicate pincodes exist in the sheet: ${uniquePincodes.join(
          ', ',
        )}`;
      }
      if (dbHubCode !== hubCodeArr[0]) {
        return 'Selected hub is different from the sheet hubcode';
      }
    } catch (exception) {
      console.error(__line, exception);
      throw exception;
    }
  }

  async getPincodeExport(hubId) {
    try {
      hubId = hubId ? hubId.split(',') : [];
      if (!hubId.length) throw new Error('Please select hub');

      const query = await hubPincodeModel.getPincodeExport(hubId);
      const connection = await readDB.getConnection();
      const csv = new CsvWriter();
      let key = ``;
      if (hubId[0] === 'template') {
        key = `template/hub_serviceability-${dayjs(new Date()).format(
          'DD-MMM-YYYY',
        )}-${Date.now()}.csv`;
      } else {
        key = `shyptrackreports/users/hub_serviceability_export-${dayjs(
          new Date(),
        ).format('DD-MMM-YYYY')}-${Date.now()}.csv`;
      }
      const filePath = `${os.tmpdir()}/${new Date()}.csv`;
      await csv.initialize({ schema, filePath });
      const pincode_array = [];
      const addRows = async (data) => {
        data = data.map((item) => {
          item.pincode = item?.pincode || '-';
          item.code = item?.code || '-';
          return item;
        });
        for (let item of data) {
          csv.writeRow(item);
        }
      };
      await new Promise((resolve, reject) => {
        connection.connection
          .query(query)
          .on('error', (err) => {
            connection.release();
            reject(err);
          })
          .on('result', async (item) => {
            pincode_array.push(item);

            if (pincode_array.length < BATCH_SIZE) return;

            connection.pause();

            await addRows(pincode_array, csv);

            pincode_array.length = 0;

            connection.resume();
          })
          .on('end', async () => {
            connection.release();
            if (pincode_array.length > 0) {
              await addRows(pincode_array, csv);
            }
            await csv.closeFile();
            resolve();
          });
      });
      const S3 = new S3_MODULE();
      await S3.uploadToS3('', key, filePath); // upload on s3
      return S3.getFilePath(key, 360); // return filepath
    } catch (exception) {
      console.error(__line, exception);
      throw exception;
    }
  }

    async getUserListRiderOrOther(rider = false) {
        try {
            return hubModel.getUserListRiderOrOther(rider);
        } catch (exception) {
            console.error(__line, exception);
            throw exception;
        }
    }

    async getAllHubList() {
        try {
            return hubModel.getAllHubList();
      } catch (exception) {
            console.error(__line, exception);
            throw exception;
        }
    }
  
  async zoneEnabledHubList() {
    try {
      return hubModel.zoneEnabledHubList();
    } catch (exception) {
      console.error(__line, exception);
      throw exception;
    }
  }
}

module.exports = Hub;
