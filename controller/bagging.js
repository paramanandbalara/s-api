'use strict'

const baggingModel = require('../models/bagging');
const hubModel = require('../models/hub');
const EventController = require('./event');
const ordersModel = require('../models/orders');
const moment = require('moment');
const eventController = new EventController();
const S3_MODULE = require('../modules/s3');
const { uploadDocument } = require('../modules/uploadDocument');
const os = require('os');
const { es6viewsParser, appendEs6FileOnHtml, getSlipHtmlToPDF } = require('../modules/htmlFunction');
const { sendNotification } = require('../modules/sendNotification');
const { getAppNotificationByName } = require('../models/appNotification');

const BAG_PERFIX = {
    1: "PK-", //for pickup
    2: "DV-" //for delivery
}


class Bagging {

    static DEFAULT_PAGE = 1;
    static DEFAULT_LIMIT = 25;
    static baggedStatus = [6, 7, 8, 9, 10, 11, 12, 13, 14]

    async bagAwb({ awb, userId, hub_id, bagType }) {
        try {
            if (awb) {
                awb = awb.trim();
            };
            let [order_details] = await ordersModel.checkWhetherAwbExist(awb);

            const bag_started_status = 14;

            let bag_id = ``;
            if (!order_details) {
                throw new Error(`No order found for AWB (${awb})`)
            }

            const { pickup_delivery, dropoff_hub_id, hub_id: orderHubId, orderStatus, id: orderId, inscan_hub_id: inscanHubId } = order_details;

            if (Bagging.baggedStatus.includes(Number(orderStatus))) {
                throw new Error(`Order already bagged`);
            }
            if (orderStatus != 5) {
                throw new Error(`Order not scanned at origin hub`);
            }

            if (pickup_delivery === 1) {
                bag_id = await this.createBagForPickupOrder({ userId, hub_id, orderHubId, orderStatus, type: 1, pickup_delivery, awb, inscanHubId, bagType })
            }

            if (pickup_delivery === 2) {


                bag_id = await this.createBagForDeliveryOrder({ userId, hub_id, orderHubId, orderStatus, type: 2, pickup_delivery, awb, inscanHubId, bagType })
            }

            await ordersModel.updateOrderDetails(orderId, { status: bag_started_status, bag_id })

            let event_obj = {
                status: bag_started_status,
                orders: [order_details]
            }

            eventController.createEvent(event_obj);
            return { bag_id };

        } catch (exception) {
            console.error(exception);
            throw exception;
        }

    }

    async createBagForPickupOrder({
        hub_id: hubId,
        userId,
        pickup_delivery: pickupDelivery,
        inscanHubId,
        bagType }) {
        try {
            const selectedHubDetails = await hubModel.getHubDetailsById(hubId);

            if (!selectedHubDetails) {
                throw new Error('Hub not found')
            }
            if (selectedHubDetails.type == 3) {
                throw new Error(`You don't have permission to perform this task. You may check with support admin`)
            }
            const [gatewayDetails] = await hubModel.getHubByCode(selectedHubDetails.gateway_code);


            if (!gatewayDetails) { //check gateway assigned or not to selected hub
                throw new Error('No gateway assigned to you');
            }
            const { id: gatewayId, code: gatewayCode } = gatewayDetails

            if (hubId !== inscanHubId) {
                const isGatewayMatching = selectedHubDetails.type === 2
                    ? selectedHubDetails.gateway_code === gatewayCode
                    : false;

                if (!isGatewayMatching) {
                    throw new Error(`AWB doesn't belong to the selected hub. Please check and select the correct hub.`);
                }
            }

            const [bagDetails] = await baggingModel.getLastBagByHubId({ hub_id: hubId, pickupDelivery });

            return this.saveBagDetails({ bagDetails, gatewayId, pickupDelivery, userId, hubDetails: selectedHubDetails, hubId, bagType })

        } catch (error) {
            console.error(error);
            throw new Error(`Failed to create bag for pickup order: ${error.message}`);
        }
    }


    async createBagForDeliveryOrder({ hub_id, orderHubId, userId, pickup_delivery: pickupDelivery, inscanHubId, awb, bagType }) {
        try {
            if (hub_id !== inscanHubId) {
                throw new Error(`AWB (${awb}) doesn't belong to the selected hub. Please select the correct hub.`);
            }
            const hubDetails = await hubModel.getHubDetailsById(orderHubId);
            if (!hubDetails) {
                throw new Error('Hub not found')
            }
            const [bagDetails] = await baggingModel.getBagsByGatewayId({ gatewayId: orderHubId, bag_state: [1, 2, 3], pickupDelivery });
            return this.saveBagDetails({ bagDetails, gatewayId: orderHubId, pickupDelivery, userId, hubDetails, hubId: hub_id, bagType })
        } catch (error) {
            console.error(error);
            throw new Error(`Failed to create bag for delivery order: ${error.message}`);
        }
    }

    async saveBagDetails({ bagDetails, gatewayId, pickupDelivery, userId, hubDetails, hubId, bagType }) {
        try {
            const { bag_state, bag_code, type, id: bagId, hub_id: originHub, bag_type: bagTypeInDb } = bagDetails || {};

            //only check this condition in case of bag b/c in case of box every time we create new box code
            //bagType 1 means bag 2 means box
            if (bagType === 1) {
                const shouldAddToPreviousOpenBag = this.shouldAddToPreviousOpenBag(bag_state, type, originHub, hubId, bagType, bagTypeInDb, pickupDelivery);
                if (shouldAddToPreviousOpenBag) {
                    // If the conditions are met, return the existing bagId
                    return bagId;
                } else if (bagTypeInDb !== bagType) {
                    // If the bag type is different, check for a bag of the same type in the hub
                    const [lastBagByHubId] = pickupDelivery === 1 ? await baggingModel.getLastBagByHubId({ hub_id: hubId, pickupDelivery }) :
                        await baggingModel.getBagsByGatewayId({
                            gatewayId, bag_state: [1, 2, 3],
                            bagType, pickupDelivery
                        });
                    const { bag_state: lastBagState, type: lastBagType, id: lastBagId, hub_id: lastBagOriginHub, bag_type: lastBagTypeInDb } = lastBagByHubId || {};
                    const shouldAddToPreviousOpenBag = this.shouldAddToPreviousOpenBag(lastBagState, lastBagType, lastBagOriginHub, hubId, bagType, lastBagTypeInDb, pickupDelivery);

                    if (shouldAddToPreviousOpenBag) {
                        // If the conditions are met, return the existing bagId
                        return lastBagId;
                    }
                }

                //if shouldAddToPreviousOpenBag and bag type is delivery then check again to remove 
                /*
                below conditions 
                Is it that in the case of delivery, 
                multiple bags are created for the same destination at different hubs (like Delhi or the origin), 
                and the bag code is based on the destination. 
                But if at the origin hub, one bag is already open for the same destination and another bag is also open for the same destination 
                at another hub, and an order for the bag arrives at the first one, 
                then it will create a new bag. However, the bag is already open,
                so it should go in there. */
                 if (!shouldAddToPreviousOpenBag && pickupDelivery === 2) {
                    const [deliveryBagDetails] = await baggingModel.getDeliveryBagByGatewayAndHubId(gatewayId, hubId, bagType)

                    const { bag_state: deliveryBagState, type: deliveryBagType, id: deliveryBagId, hub_id: deliveryBagOriginHub, bag_type: deliveryBagTypeInDb } = deliveryBagDetails || {};
                    const shouldAddToPreviousOpenBag = this.shouldAddToPreviousOpenBag(deliveryBagState, deliveryBagType, deliveryBagOriginHub, hubId, bagType, deliveryBagTypeInDb, pickupDelivery);

                    if (shouldAddToPreviousOpenBag) {
                        // If the conditions are met, return the existing bagId
                        return deliveryBagId;
                    }
                }
            }

            // Generate a new bag code based on hubDetails and bag_code
            const newBagCode = this.getNewBagCode({ hubDetails, existingBagCode: bag_code, pickupDelivery });

            // Prepare bag data for saving
            const bagData = {
                bag_code: newBagCode,
                bag_state: 1,  // Bag state is "open at hub"
                hub_id: hubId,
                scan_by: userId,
                gateway_id: gatewayId,
                type: pickupDelivery,
                bag_type: bagType
            };

            // Save the new bag
            const saveBag = await baggingModel.saveNewBag(bagData);

            // Return the insertId of the saved bag
            return saveBag.insertId;
        } catch (error) {
            console.error(error);
            throw new Error(`Failed to create bag for pickup order: ${error.message}`);
        }
    }

    /**
  * Determines whether an item should be added to a previously open bag based on specific criteria.
  *
  * @param {number} bag_state - The state of the bag: 1 for "open at hub", 2 for "closed at hub", 3 for "Inbound Complete at Gateway".
  * @param {number} type - The type of the bag: 1 for bag for pickup orders, 2 for bag for delivery.
  * @param {number} originHub - The ID of the hub where the bag was created or the bag hub ID.
  * @param {number} hubId - The ID of the hub to compare with the origin hub.  (selected hub id by user)
  * @param {number} bagType - The user-selected bag type: 1 for bag, 2 for box.
  * @param {number} bagTypeInDb - The bag type stored in the database: 1 for bag, 2 for box.
  * @param {number} pickupDelivery - The type of order: 1 for pickup, 2 for delivery.
  * @returns {boolean} - Returns true if the item should be added to a previously open bag, false otherwise.
  */
    shouldAddToPreviousOpenBag(bag_state, type, originHub, hubId, bagType, bagTypeInDb, pickupDelivery) {
        return (
            bag_state === 1 &&  // Bag state is "open at hub"
            type === pickupDelivery &&  // Type is "pickupDelivery"
            originHub === hubId &&  // Origin hub matches hubId
            bagType === 1 &&  // Bag type is "bag"
            bagTypeInDb === bagType  // Bag type in db matches bagType
        );
    }



    getNewBagCode({ hubDetails, existingBagCode = null, pickupDelivery }) {
        try {
            const { code: hubCode } = hubDetails;
            const date = moment().format('DDMM');
            const prefix = BAG_PERFIX[pickupDelivery];
            const newBagCode = prefix + hubCode + date;

            if (!existingBagCode || !existingBagCode.startsWith(newBagCode)) {
                return newBagCode + '-1';
            }
            const splitBagCode = existingBagCode.split('-')
            const existingBagCount = Number(splitBagCode[splitBagCode.length - 1]);
            const newBagCount = existingBagCount + 1;

            return `${newBagCode}-${newBagCount}`;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }


    async closeBag({
        bagId,
        bagSealNo,
        bagWeight,
        bagImg,
        bagImgType,
        hubId,
        bagLength = 0,
        bagWidth = 0,
        bagHeight = 0,
    }) {
        try {
            const baggedStatus = 6;
			const emailType = [1, 4, 5, 7];

            this.validateBagDetails(bagWeight, bagSealNo);
            bagSealNo = bagSealNo.trim();

            const [bagDetails] = await baggingModel.getBagDetailsById(bagId);
            if (!bagDetails) throw new Error('Bag not found.');

            const { bag_code: bagCode, bag_state: bagState, bag_type: bagType } = bagDetails;
            if (bagState !== 1) throw new Error('Bag not in an open state.');

            const [sealDetails] = await baggingModel.getBagDetailsBySealNo(bagSealNo);
            if (sealDetails) throw new Error('Seal number already used.');

            const bagDate = new Date();


            await baggingModel.closeBag(bagId, {
                bag_sealno: bagSealNo,
                bag_weight: bagWeight,
                bag_state: 2,
                bag_date: bagDate,
                bag_length: bagLength,
                bag_width: bagWidth,
                bag_height: bagHeight
            }
            );

            const ordersInBag = await baggingModel.getOrderListByBagId(bagId);
            if (ordersInBag.length) {
                const orderIdsArr = ordersInBag.map(order => order.id);
                const eventObj = {
                    status: baggedStatus,
                    orders: ordersInBag,
                };
                await ordersModel.updateOrderDetails(orderIdsArr, { status: baggedStatus });
                eventController.createEvent(eventObj)
            }

            //update seal and bag count only in case of bag
            if (bagType === 1) {
                await hubModel.updateBagSealCount(hubId, -1, -1);
				const notificationData = await getAppNotificationByName(
					'bag_seal_count'
				);
				const {
					type: notificationType,
					status : notificationStatus,
					audience,
					receiver
				} = notificationData[0] ?? {};

				if (
					notificationStatus === 1 &&
					audience === 1 &&
					emailType.includes(notificationType) 
				) {
					this.checkLowInventoryAndSendNotification(hubId);
				}
            }

            this.uploadBagImage(bagImg, bagImgType, bagCode);

        } catch (exception) {
            console.error(exception);
            throw exception;;
        }
    }


    validateBagDetails(bagWeight, bagSealNo) {
        if (!bagWeight) {
            throw new Error('Please enter the bag weight.');
        }
        if (!bagSealNo) {
            throw new Error('Please enter the seal number.');
        }
    }


    async uploadBagImage(bagImg, bagImgType, bagCode) {
        try {
            if (bagImg && bagImgType) {
                const uploadData = {
                    file_name: bagImg,
                    file_type: bagImgType,
                    key: `bag/${bagCode}.${bagImgType}`,
                };
                await uploadDocument(uploadData);
            }
        } catch (exception) {
            console.error(exception);
        }
    }



    async checkLowInventoryAndSendNotification(hubId) {
        // Checking low bag/seal inventory and sending a notification if necessary
        try {
            const hubDetails = await hubModel.getHubDetailsById(hubId);
            const { available_bag_count: availableBagCount, available_seal_count: availableSealCount, contact_email: contactEmail, code: hubCode, city: hubCity, contact_name: contactName } = hubDetails;

            if (availableBagCount === 20 || availableSealCount === 20) {
                const emailSubject = `Alert | Low Bag/Seal Inventory - ${hubCode}`;
                const emailContent = {
                    code: hubCode,
                    city: hubCity,
                };
                const emailObj = {
                    email: null,
                    subject: emailSubject,
                    email_content: emailContent,
                };
                const data = {
                    emailObj,
                    eventName: 'bag_seal_count',
                };
                await sendNotification(data);
            }
        } catch (exception) {
            console.error(exception);
        }
    }


    async getClosedBagList(pageNo, offsetRow, hubId) {
        try {
            //The state of the bag: 1 for "open at hub", 2 for "closed at hub", 3 for "Inbound Complete at Gateway".
            const bagState = [2];
            const limit = parseInt(offsetRow ?? Bagging.DEFAULT_LIMIT);
            pageNo = parseInt(pageNo ?? Bagging.DEFAULT_PAGE)
            const offset = (pageNo - 1) * limit;

            const closeBagList = await baggingModel.getBagsByHubId({
                hub_id: hubId,
                bag_state: bagState,
                list: true,
                offset,
                limit: limit + 1,
            });

            const hasNext = closeBagList.length === limit + 1;
            const hasPrev = pageNo > 1;
            const data = closeBagList.slice(0, limit);

            return { data, hasNext, hasPrev };
        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception);
        }
    }


    async outScanBags(data) {
        try {

            const order_status = 7;

            let { bags_list, transporter_id, transporter_awbno = null, airway_bill_img, airway_bill_type, user_id, hub_id } = data;
            transporter_awbno = (transporter_awbno && transporter_awbno.trim()) || null;

            if (!transporter_awbno) {
                transporter_awbno = `temp-airway-${+new Date()}`
            }


            if (!Array.isArray(bags_list) || !bags_list.length) {
                throw new Error("Please submit the Bag Code/Bag Seal No")
            }

            if (!transporter_id) {
                throw new Error("Please select Transporter")
            }

            const bags = await baggingModel.getBagsByBagcode(bags_list, hub_id);
            let dup_out_scan_bag = []
            const bag_ids_arr = bags.map((item) => {

                if (item.outscan_date || item.outscan_date !== null) {
                    const code = bags_list.includes(item.bag_code) ? item.bag_code : item.bag_sealno;
                    dup_out_scan_bag.push(code)
                }

                return item.id
            });

            if (dup_out_scan_bag.length) {
                dup_out_scan_bag = dup_out_scan_bag.join(', ')
                throw new Error(`Bag seal number is already added / Outscanned (${dup_out_scan_bag} )`)
            }

            if (!bag_ids_arr.length) {
                throw new Error('Please enter correct bagseal no')
            }

            const outscan_date = new Date();

            const update_bag = await baggingModel.updateBagDetails(bag_ids_arr, { transporter_id, outscan_date, transporter_awbno });

            const orders = await ordersModel.getOrdersByBag(bag_ids_arr);
            if (orders.length) {

                let event_obj = {
                    status: order_status,
                    orders: orders
                }

                const order_ids_arr = orders.map(item => item.id);
                const bag_order = await ordersModel.updateOrderDetails(order_ids_arr, { status: order_status })
                const create_order_event = await eventController.createEvent(event_obj);
            }

            if (airway_bill_img && airway_bill_type) {

                const upload_data = {
                    file_name: airway_bill_img,
                    file_type: airway_bill_type,
                    key: `airway-bill/${transporter_awbno}.${airway_bill_type}`
                }
                await uploadDocument(upload_data)
            }

            return true;
        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception)
        }
    }

    async transporterList(user_id, hub_id) {
        try {
            const result = await baggingModel.transporterList(hub_id);

            return result;
        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception)
        }
    }

    async outScanBagsList(user_id, page_no, offset_row, hub_id) {
        try {
            let hasNext = false, hasPrev = false;
            let page = parseInt(page_no ?? Bagging.DEFAULT_PAGE);
            let limit = parseInt(offset_row ?? Bagging.DEFAULT_LIMIT);

            //Page no. starts from 1
            let offset = (page - 1) * limit;

            let rows = await baggingModel.getOutScanedBags(hub_id, offset, limit + 1);

            if (rows.length == limit + 1)
                hasNext = true;

            if (page > 1)
                hasPrev = true;

            rows = rows.slice(0, limit);

            return { data: rows, hasNext, hasPrev };
        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception)
        }
    }

    async getOpenBagList(hubId) {
        try {
            return baggingModel.getBagsByHubId({ hub_id: hubId, bag_state: [1] });  //bag_state 1 for open bag
        } catch (exception) {
            console.error(exception);
            throw exception;
        }
    }

    async bagLabelData(bag_id, user_id, hub_id) {
        try {
            let bag_details = await baggingModel.bagLabelData(bag_id);

            if (!bag_details.length) {
                throw new Error('Bag not found.')
            }

            bag_details = bag_details[0]
            let destination_address = bag_details.address.trim() + ", " + bag_details.city.trim() + ", " + bag_details.state.trim();

            let hub_addr = await hubModel.getHubDetailsById(hub_id);

            let origin_address = hub_addr.address.trim() + ", " + hub_addr.city.trim() + ", " + hub_addr.state.trim();

            bag_details.origin_address = origin_address;
            bag_details.destination_address = destination_address;


            try {

                let s3 = new S3_MODULE();

                let arr_bag_details = [bag_details]
                arr_bag_details[0].bag_date = moment(arr_bag_details[0].bag_date).utcOffset(330).format('DD-MM-YYYY hh:mm A')

                if (!arr_bag_details.length) {
                    throw new Error("No data found");
                }

                let key = `bag-label/${arr_bag_details[0].bag_code}_${moment(new Date()).format('DD-MM-YYYY')}.pdf`

                let fileExists = await s3.checkFileExistence(key)
                if (fileExists) {
                    let filepath = await s3.getFilePath(key);

                    return filepath;
                }
                else {
                    const es6_path = __dirname + '/../views/generate_bag_label.es6';

                    const html_path = `${os.tmpdir()}/shyptrack/bag-label.html`;

                    const file_path = `${os.tmpdir()}/shyptrack/bag-label/${arr_bag_details[0].bag_code}_${moment(new Date()).format('DD-MM-YYYY')}.pdf`

                    const html_data = await es6viewsParser(es6_path, { arr_bag_details });

                    const get_html = await appendEs6FileOnHtml(html_path, html_data);

                    const generate_pdf = await getSlipHtmlToPDF(html_path, file_path);

                    await s3.uploadToS3(null, key, file_path);

                    let filepath = await s3.getFilePath(key);

                    return filepath
                }

            }
            catch (exception) {
                console.error(exception);
                throw new Error(exception.message || exception)
            }
        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception)
        }
    }

    /**
 * Checks if a bag is valid based on its code and hub ID.
 * @param {string} code - The bag code to check.
 * @param {string} hubId - The ID of the selected hub.
 * @returns {boolean} - True if the bag is valid, otherwise throws an error.
 */
    async checkIsValidBag(code, hubId) {
        try {
            // Trim the bag code to remove any leading or trailing whitespace
            code = code.trim();

            // Retrieve bag details from the database based on the bag code
            const [bagDetails] = await baggingModel.getBagsByBagcode([code]);

            if (!bagDetails) {
                throw new Error('Invalid bag seal number. Please enter a correct bag seal number.');
            }
            const { hub_id: bagHubId, outscan_date: outscanDate, bag_state: bagState } = bagDetails;
            // Check if the bag belongs to the selected hub
            if (bagHubId !== hubId) {
                throw new Error('The bag does not belong to the selected hub. Please check and select the correct hub.');
            }

            // Check if the bag has already been outscanned
            if (outscanDate) {
                throw new Error('The bag has already been outscanned.');
            }

            // Check if the bag is closed at the hub
            if (bagState !== 2) {
                // 1 - Open at hub, 2 - Closed at hub, 3 - Inbound complete at gateway
                throw new Error('The bag is not closed.');
            }

            // If all checks pass, the bag is valid
            return true;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }



    /**
   * Updates bag details with the provided airway bill information
   * @param {String} airwayBillNumber - the airway bill number to update the bags with
   * @param {Array} bagCodes - an array of bag codes to update with the airway bill number
   * @param {Number} transporterId - the ID of the transporter associated with the bags
   * @param {String} airwayBillImg - (optional) the airway bill image file name
   * @param {String} airwayBillType - (optional) the file type of the airway bill image
   * @returns {Boolean} - true if the update is successful
   * @throws {Error} - if the input parameters are invalid or if the transporter AWB number already exists in the system
   */
    async updateBagDetailsWithAirwayBill({ airwayBillNumber, bagCodes, transporterId, airwayBillImg = null, airwayBillType = null }) {
        // Validate input parameters
        if (!Array.isArray(bagCodes) || !bagCodes.length || !airwayBillNumber || !transporterId) {
            throw new Error("Invalid input parameters");
        }

        try {
            // Check if the transporter AWB number already exists

            // Get bag details from bag codes
            const bagDetails = await baggingModel.getBagsByBagcode(bagCodes);

            // Handle case where no bags are found with the given codes
            if (!bagDetails.length) {
                throw new Error(`No bag details found for codes ${bagCodes.join(", ")}`);
            }

            // Update the bags with the new airway bill number
            const bagsWithDifferentTransporters = [];
            const bagIds = bagDetails
                .map(({ transporter_id, bag_sealno, id }) => {
                    if (transporter_id !== transporterId) {
                        bagsWithDifferentTransporters.push(bag_sealno);
                    }
                    return id;
                });

            if (bagsWithDifferentTransporters.length) {
                throw new Error("Selected bags are from different transporter");
            }
            const { transporter_awbno: temoTransporterAirwayBill } = bagDetails[0];
            await baggingModel.updateBagDetailsbyTransportrAwb(temoTransporterAirwayBill, { transporter_awbno: airwayBillNumber });

            // Upload the airway bill image, if provided
            if (airwayBillImg && airwayBillType) {
                const uploadData = {
                    file_name: airwayBillImg,
                    file_type: airwayBillType,
                    key: `airway-bill/${airwayBillNumber}.${airwayBillType}`
                };
                await uploadDocument(uploadData);
            }

            return true;
        } catch (error) {
            console.error(error);
            throw new Error(`Error updating bag details: ${error.message}`);
        }
    }

}

module.exports = Bagging;
