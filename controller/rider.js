"use strict";

const RiderModel = require('../models/rider');
const dayjs = require('dayjs');
const PATH = require('path');
const CsvWriter = require('../modules/csvWriter');
const os = require("os");
const S3Class = require('../modules/s3');
const OrdersModel = require('../models/orders')
const {ewaybill_exempt_modes : EWAY_BILL_EXEMPT_MODES} = require('../../shyptrack-static/stconfig.json');

const schema = [
    { header: "Date", key: "created", coerceString: true },
    { header: "Rider Name", key: "rider_name" },
    { header: "City", key: "city" },
    { header: "State", key: "state" },
    { header: "Check-in", key: "checkin_date", coerceString: true },
    { header: "Check-out", key: "checkout_date", coerceString: true },
    { header: "Check-in Odometer", key: "checkin_odometer_reading" },
    { header: "Check-out Odometer", key: "checkout_odometer_reading" },
    { header: "KM(s) Covered", key: "kmCovered" },
];

const BATCH_SIZE = 100;


class RIDER {

    static DEFAULT_PAGE = 1;
    static DEFAULT_LIMIT = 25;

    async insertRiderCheckinImage(body, files) {
        try {
            const { user_id } = body;

            if (files) {
               
                const S3classInstance = new S3Class();
                const filePath = `checkin_selfie_${dayjs(new Date).format('YYYY-MM-DD')}`
                

                const extName = PATH.extname(files.checkin_selfie_[0].originalname).toLowerCase()
                const fileName = `users/${user_id}/check-in-out-image/${filePath}${extName}`
                const contentType = files.checkin_selfie_[0].mimetype
                if (fileName != '' && contentType != '' && files.checkin_selfie_[0].buffer.length) {
                    S3classInstance.s3Upload(fileName, files.checkin_selfie_[0].buffer, contentType)
                    .catch(error => console.error(error))
                }
            }

            return true;
        } catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async insertRiderCheckinDate({ checkin_odometer_reading: checkinOdometerReading, user_id, checkin_lat = null, checkin_lng = null }, files) {
        try {
            checkinOdometerReading = Number(checkinOdometerReading);
            if (isNaN(checkinOdometerReading)) {
                throw new Error('Special characters are not allowed for checkin_odometer_reading');
            }

            this.validateCordinates(checkin_lat, checkin_lng);

            if (files) {
                const S3classInstance = new S3Class();
                const filePath = `checkin_odometer_${dayjs(new Date).format('YYYY-MM-DD')}`;
    
                const extName = PATH.extname(files.checkin_odometer_[0].originalname).toLowerCase();
                const fileName = `users/${user_id}/odometer/${filePath}${extName}`;
                const contentType = files.checkin_odometer_[0].mimetype;
    
                if (fileName != '' && contentType != '' && files.checkin_odometer_[0].buffer.length) {
                    S3classInstance.s3Upload(fileName, files.checkin_odometer_[0].buffer, contentType)
                        .catch(error => console.error(error));
                }
            }
    
            const insertObj = {
                user_id,
                checkin_date: new Date(),
                checkin_odometer_reading: checkinOdometerReading,
                status: 1,
                checkin_lat,
                checkin_lng
            }
    
            const result = await RiderModel.saveCheckInCheckOutStatus(insertObj);
    
            return result;
    
        } catch (exception) {
            console.error(exception)
            throw new Error(exception.message || exception);
        }
    }

    validateCordinates(lat, lng){
        if ((lat === null) !== (lng === null)) {
            throw new Error("Please checkin again");
        }
    }
    

    async insertRiderCheckoutDate( { checkout_odometer_reading, user_id, checkout_lat = null, checkout_lng = null, proceedAnyway = true }, files) {
        try {
            checkout_odometer_reading = Number(checkout_odometer_reading);
            let readingCheck = false;
            if (isNaN(checkout_odometer_reading)) {
                throw new Error('Special characters are not allowed')
            }
            if(typeof proceedAnyway === 'string'){
                proceedAnyway = proceedAnyway === 'true'
            }
            
            const { checkin_odometer_reading, id : checkin_status_id } = (await RiderModel.getRiderCheckInStatus(user_id))[0];

            if (checkout_odometer_reading <= checkin_odometer_reading) {
                throw new Error(`Checkout reading can't be less than checkin reading (${checkin_odometer_reading})`)
            }

            const odometerReadingDiff = checkout_odometer_reading - checkin_odometer_reading;
            if (odometerReadingDiff > 200 && !proceedAnyway) {
                const warningMessage = `You drove ${odometerReadingDiff} KM, which seems wrong, Please check, if correct proceed otherwise check and update.`
                return {warningMessage, readingCheck : true};
            }
            
            this.validateCordinates(checkout_lat, checkout_lng);

            if (files) {
                const S3classInstance = new S3Class();
                const filePath = `checkout_odomter${dayjs(new Date).format('YYYY-MM-DD')}`

                const extName = PATH.extname(files.odometer_checkout_image_file[0].originalname).toLowerCase()
                const fileName = `users/${user_id}/odometer/${filePath}${extName}`
                const contentType = files.odometer_checkout_image_file[0].mimetype
                if (fileName != '' && contentType != '' && files.odometer_checkout_image_file[0].buffer.length) {
                    S3classInstance.s3Upload(fileName, files.odometer_checkout_image_file[0].buffer, contentType)
                    .catch(error => console.error(error))
                }
            }

            const updateObj = {
                user_id: user_id,
                checkout_date: new Date(),
                checkout_odometer_reading: checkout_odometer_reading,
                status: 2,
                checkout_lat,
                checkout_lng
            }

            await RiderModel.updateRiderCheckInStatus(checkin_status_id, updateObj)

            return {readingCheck, warningMessage : ''};
        } catch (exception) {
            throw new Error(exception.message || exception)
        }
    }


    async checkCheckinStatus(rider_id) {
        try {

            let checkin_status = await RiderModel.getRiderCheckInStatus(rider_id);
            if (checkin_status.length) {
                checkin_status = checkin_status[0];

                const checkin_date = dayjs(checkin_status.checkin_date).format('YYYY-MM-DD');
                const today_date = dayjs(new Date()).format('YYYY-MM-DD')

                if (checkin_status.status == 2) {
                    return { checkin: true, checkout: false }
                } else if (checkin_status.status == 1 && today_date > checkin_date) {
                    return { checkin: false, checkout: true }
                } else {
                    return { checkin: false, checkout: false }
                }
            } else {
                return { checkin: true, checkout: false }
            }

        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception)
        }
    }

    async getRiderTimeline(rider_id) {
        try {

            const result = await RiderModel.getRiderTimeline(rider_id);

            if (!result.length) {
                throw new Error("No data found")
            }

            return { data: result };
        } catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async getCheckinCheckoutData(filters, user_id) {
        try {
            let hasNext = false, hasPrev = false;

            const page = parseInt(filters.page ?? RIDER.DEFAULT_PAGE);
            let limit = parseInt(filters.offset ?? RIDER.DEFAULT_LIMIT);
            const offset = (page - 1) * limit;

            let result = await RiderModel.getCheckinCheckoutData(filters, user_id, offset, limit + 1, false);

            if (!result.length) {
                throw new Error("No data found")
            }

            let obj = {}

            result.forEach(element => {
                const key = `${dayjs(element.created).format("DD-MM-YYYY")}_${element.rider_id}`
                if (obj.hasOwnProperty(key)) {
                    return;
                }
                obj[key] = element
            });

            result = Object.values(obj)

            if (result.length == limit + 1) {
                hasNext = true;
            }

            if (page > 1) {
                hasPrev = true;
            }

            result = result.slice(0, limit);

            return { data: result, hasNext, hasPrev };

        } catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async getCheckinCheckoutImag(filters, user_id) {
        try {
            let { clicked_on, checkin_date, checkout_date, rider_id } = filters

            const S3classInstance = new S3Class();

            if (clicked_on == 'checkin_date') {

                let filePath = `users/${rider_id}/check-in-out-image`
                let allFiles = await S3classInstance.getAllFiles(filePath);
                let is_file = allFiles.find(x => x.Key.includes(`checkin_selfie_${dayjs(checkin_date).format('YYYY-MM-DD')}`))

                if (is_file) {
                    filePath = is_file.Key

                    let file_path = await S3classInstance.getFilePath(filePath)

                    return { file_path };
                }
                else {
                    throw new Error("No image found")
                }
            }

            if (clicked_on == 'checkin_odometer_reading') {

                let filePath = `users/${rider_id}/odometer`
                let allFiles = await S3classInstance.getAllFiles(filePath);

                let is_file = allFiles.find(x => x.Key.includes(`checkin_odometer_${dayjs(checkin_date).format('YYYY-MM-DD')}`))

                if (is_file) {
                    filePath = is_file.Key

                    let file_path = await S3classInstance.getFilePath(filePath)

                    return { file_path };
                }
                else {
                    throw new Error("No image found")
                }
            }

            if (clicked_on == 'checkout_odometer_reading') {

                let filePath = `users/${rider_id}/odometer`
                let allFiles = await S3classInstance.getAllFiles(filePath);

                let is_file = allFiles.find(x => x.Key.includes(`checkout_odomter${dayjs(checkout_date).format('YYYY-MM-DD')}`))

                if (is_file) {
                    filePath = is_file.Key

                    let file_path = await S3classInstance.getFilePath(filePath)

                    return { file_path };
                }
                else {
                    throw new Error("No image found")
                }
            }

        } catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async getcheckincheckoutExport(filters, user_id) {
        try {

            const queryString = await RiderModel.getCheckinCheckoutData(filters, user_id, "", "", true);

            const connection = await readDB.getConnection();

            const csv = new CsvWriter()

            const fileName = `check-in-out_export-${dayjs(new Date()).format('DD-MMM-YYYY')}-${Date.now()}.csv`;

            const filePath = `${os.tmpdir()}/${fileName}`;

            await csv.initialize({ schema, filePath })

            let check_in_out_data = [];

            const addRows = async (data) => {

                let obj = {}

                data.forEach(element => {
                    const key = `${dayjs(element.created).format("DD-MM-YYYY")}_${element.rider_id}`
                    if (obj.hasOwnProperty(key)) {
                        return;
                    }
                    obj[key] = element
                });

                data = Object.values(obj)

                for (const iterator of data) {
                    iterator.kmCovered = iterator.checkout_odometer_reading - iterator.checkin_odometer_reading
                }

                data = data.map(i => {
                    i.created = i?.created ? dayjs(i.created).format('DD-MM-YYYY') : '-';
                    i.rider_name = i?.rider_name ? i.rider_name : '-';
                    i.city = i?.city ? i.city : '-';
                    i.state = i?.state ? i.state : '-';
                    i.checkin_date = i?.checkin_date ? dayjs(i.checkin_date).format('DD-MM-YYYY') : '-';
                    i.checkout_date = i?.checkout_date ? dayjs(i.checkout_date).format('DD-MM-YYYY') : '-';
                    i.checkin_odometer_reading = i?.checkin_odometer_reading ?? '-';
                    i.checkout_odometer_reading = i?.checkout_odometer_reading ?? '-';
                    i.kmCovered = (Number(i.checkout_odometer_reading) - Number(i.checkin_odometer_reading)).toFixed(1) > 0 ? (Number(i.checkout_odometer_reading) - Number(i.checkin_odometer_reading)).toFixed(1) : 0;

                    return i;
                })

                for (let i of data) {
                    csv.writeRow(i)
                }
            }

            const promise = new Promise((resolve, reject) => {

                connection.connection.query(queryString)
                    .on('error', (err) => {
                        connection.release();
                        reject(err);
                    })
                    .on('result', async (i) => {

                        check_in_out_data.push(i);

                        if (check_in_out_data.length < BATCH_SIZE)
                            return

                        connection.pause();

                        await addRows(check_in_out_data, csv)

                        check_in_out_data = []

                        connection.resume();
                    })
                    .on('end', async () => {
                        connection.release();

                        if (check_in_out_data.length > 0) {

                            await addRows(check_in_out_data, csv)
                        }

                        await csv.closeFile()
                        resolve()
                    })
            })

            await promise;
            const S3 = new S3Class();
            const key = `shyptrackreports/users/${fileName}`;
            const upload = await S3.uploadToS3('', key, filePath);
            const signedURL = await S3.getFilePath(key, 360);

            return signedURL;

        }
        catch (exception) {
            console.error(__line, exception)
            throw new Error(exception.message || exception)
        }
    }

    async uploadItemImage({ awb, pickupRequestId, routeRequestAssignedId, file }) {
        if (!file) {
            throw new Error('File parameter is missing or invalid');
        }

        try {
            const S3classInstance = new S3Class();
            const fileExtension = PATH.extname(file.itemImage[0].originalname).toLowerCase();
            const fileKey = `sppj-image/${awb}_item${fileExtension}`;
            const contentType = file.itemImage[0].mimetype;

            if (contentType && file.itemImage[0].buffer.length) {
                const s3UploadResponse = await S3classInstance.s3Upload(fileKey, file.itemImage[0].buffer, contentType);
                return true;
            } else {
                throw new Error('One or more required parameters are missing or invalid');
            }
        } catch (error) {
            console.error('Error uploading image to S3:', error);
            throw new Error('Unable to upload image to S3');
        }
    }


    async uploadpackageAndParcelImage({ file, fileName, key }) {
        if (!file) {
            throw new Error('File parameter is missing or invalid');
        }

        try {
            const S3classInstance = new S3Class();
            const fileExtension = PATH.extname(file[key][0].originalname).toLowerCase();
            const fileKey = `sppj-image/${fileName}${fileExtension}`;
            const contentType = file[key][0].mimetype;

            if (contentType && file[key][0].buffer.length) {
                const s3UploadResponse = await S3classInstance.s3Upload(fileKey, file[key][0].buffer, contentType);
                return true;
            } else {
                throw new Error('One or more required parameters are missing or invalid');
            }
        } catch (error) {
            console.error('Error uploading image to S3:', error);
            throw Error(`Unable to upload image to S3 : ${error.message}`);
        }
    }

    async eWayBillUpload({ awb, eway_billno }, files) {
        try {
            // Check if the AWB exists for tracking
            const awbData = await OrdersModel.checkWhetherAwbExistForTracking([awb]);
            if(!awbData.length){
                throw new Error("Awb does not exist in our system");
            }
            const {shypmax_id, id, package_value, mode : dbModeName} = awbData[0]
            
            if(!EWAY_BILL_EXEMPT_MODES.includes(dbModeName) && package_value < 50000) {
                throw new Error("Eway bill not required for this awb");
            }

            if (files) {
                const S3classInstance = new S3Class();
                // Get the file extension and convert it to lowercase
                const extName = PATH.extname(files.eWayFile[0].originalname).toLowerCase();
                // Generate the file name for S3 storage
                const fileName = `ewaybill/${shypmax_id}${extName}`;
                // Get the content type of the file
                const contentType = files.eWayFile[0].mimetype;
                if (contentType !== '' && files.eWayFile[0].buffer.length) {
                    // Upload the file to S3
                    S3classInstance.s3Upload(fileName, files.eWayFile[0].buffer, contentType)
                        .catch(error => console.error(error));
                }
            }
            
            // Update the order details with the e-way bill number
            await OrdersModel.updateOrderDetails([id], { eway_billno });
            
            return true;
        } catch (exception) {
            // Throw an error with the exception message
            throw new Error(exception.message || exception);
        }
    }
}

module.exports = RIDER;
