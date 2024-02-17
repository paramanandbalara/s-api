'use strict';

// Import required modules
const { fetchAndSaveOrderDetails } = require('../modules/getDataFromShypmax');
const EventController = require('./event');
const HubModel = require('../models/hub');
const OrdersModel = require('../models/orders');
const UtilClass = require('./util')
const CsvWriter = require('../modules/csvWriter');
const os = require("os");
const dayjs = require('dayjs');
const S3_MODULE = require('../modules/s3');
const InboundModel = require('../models/inbound')


const VALID_ORDER_STATUSES_FOR_DROPOFF = [0, 1, 3, 16, 17, 20, 21];

const schema = [
    {header: "AWB", key:"awb", coerceString: true},
    {header: "Shypmax ID", key: "shypmax_id", coerceString: true},
    {header: "Company Name", key: "company_name"},
    {header : "Seller ID", key : "seller_id"},
    {header: "Hub Code", key: "code"},
    {header : "Hub City", key : "city"},
    {header : "Drop Off Date", key : "event_created_at", coerceString: true}
];

const BATCH_SIZE = 100;


// Define class DropOffOrders
class DropOffOrders {
    // Define class variables
    dropOffStatus = 18;
    DEFAULT_PAGE = 1;
    DEFAULT_LIMIT = 25;

    /**
     * Drops off a shipment at the specified destination hub.
     *
     * @param {string} shypmax_id - The ID of the shipment to drop off.
     * @param {string} hubId - The ID of the destination hub.
     * @returns {Promise<boolean>} - A Promise that resolves to `true` if the shipment was dropped off successfully, or `false` if an error occurred.
     */
    async dropOffOrder(shypmax_id, hubId) {
        try {
            // Create an instance of the EventController class to handle events
            const eventController = new EventController();
            const util = new UtilClass()

            // Check whether the shipment exists in the orders database
            let [orderDetails] = await OrdersModel.checkWhetherAwbExist(shypmax_id);

            // If the shipment does not exist, fetch and save its details
            if (!orderDetails) {
                if (shypmax_id.length < 7 || shypmax_id.length > 50) {
                    throw new Error('Invalid AWB entered')
                }

                [orderDetails] = await fetchAndSaveOrderDetails(shypmax_id, hubId);
                orderDetails.hub_id = hubId;
            }

            // Get the order's status and ID
            const { orderStatus, id: orderId, pickup_request_id: pickupRequestId = null, order_receive_date = null } = orderDetails;

            // If the order status is not valid for drop off, throw an error
            if (!VALID_ORDER_STATUSES_FOR_DROPOFF.includes(orderStatus)) {
                throw new Error(`Order(${shypmax_id}) is already processed or cancelled.`);
            }

            // Get the details of the destination hub
            const { status, code: hubCode, address: currentLocation, city : hubCity } = await HubModel.getHubDetailsById(hubId);

            if (pickupRequestId) {
                await util.decrementPendingOrderCountInPickupRequest(pickupRequestId)
            }
            // Update the order details to reflect the drop off status
            const updatedOrderDetails = await OrdersModel.updateOrderDetails([orderId], { status: this.dropOffStatus, dropoff_hub_id: hubId, order_receive_date: order_receive_date || new Date() });

            // Set the details of the drop off event
            const eventObj = {
                status: this.dropOffStatus,
                orders: [orderDetails],
                remark: `Dropped off at hub (${hubCode},${hubCity})`
            };

            // Create an event for the drop off
            await eventController.createEvent(eventObj);

            // Return true to indicate success
            return true;
        } catch (error) {
            // Log the error and return false to indicate failure
            console.error(`Error dropping off shipment ${shypmax_id} at hub ${hubId}: ${error.message}`);
            throw error;
        }
    }

    async getDropOffExport( startDate, endDate, hub_id ) {
        try {

            const {query, arr} = await InboundModel.getDropOffExport( startDate, endDate, hub_id );

            const connection = await readDB.getConnection();

            const csv = new CsvWriter()

            const fileName = `dropoff_export-${dayjs(new Date()).format('DD-MMM-YYYY')}-${Date.now()}.csv`;
            
            const filePath = `${os.tmpdir()}/${fileName}`;

            await csv.initialize({schema, filePath})

            const dropoff_arr = [];

            const addRows = async (data) => {
                data = data.map(i => {
                    i.awb = i?.awb || '-';
                    i.shypmax_id = i?.shypmax_id || '-';
                    i.code = i?.code || '-';
                    i.company_name = i?.company_name || '-'
                    i.city = i?.city || '-'
                    i.seller_id = i?.seller_id || '-';
                    i.event_created_at = i?.event_created_at ? dayjs(i.event_created_at).format('DD-MM-YYYY') : '-'

                    return i
                })

                for (let i of data) {
                    csv.writeRow(i)
                }
            }
            const promise = new Promise((resolve, reject) => {

                connection.connection.query(query, arr)
                .on('error', (err) => {
                    connection.release();
                    reject(err);
                })
                .on('result', async (i) => {

                    dropoff_arr.push(i);

                    if (dropoff_arr.length < BATCH_SIZE) return;

                    connection.pause();

                    await addRows(dropoff_arr)

                    dropoff_arr.length = 0

                    connection.resume();
                })
                .on('end', async () => {
                    connection.release();

                    if (dropoff_arr.length > 0) {

                        await addRows(dropoff_arr)
                    }

                    await csv.closeFile()
                    resolve()
                })
            })

            await promise;
            const S3 = new S3_MODULE();
            const key = `shyptrackreports/users/${fileName}`;
            const upload    = await S3.uploadToS3('', key, filePath);
            const signedURL = await S3.getFilePath(key, 360);
            return signedURL;


        }
        catch (exception) {
            console.error(__line, exception)
            throw exception
        }
    }

    async droppedOffList({ page: page_no, offset: offset_row, hub_id: hubId, startDate, endDate }) {
        try {

            let hasNext = false, hasPrev = false;
            let page = Number(page_no ?? this.DEFAULT_PAGE);
            let limit = Number(offset_row ?? this.DEFAULT_LIMIT);

            let offset = (page - 1) * limit;

            startDate = dayjs(startDate || new Date()).format('YYYY-MM-DD 00:00:00');
            endDate = dayjs(endDate || new Date()).format('YYYY-MM-DD 23:59:59');

            let dropOffOrdersList = await InboundModel.droppedOffList({ limit : limit + 1, offset, hubId, startDate, endDate });

            if (dropOffOrdersList.length == limit + 1)
                hasNext = true;

            if (page > 1)
                hasPrev = true;

            dropOffOrdersList = dropOffOrdersList.slice(0, limit);

            return { data: dropOffOrdersList, hasNext, hasPrev };

        } catch (exception) {
            console.error(exception);
            throw new Error(exception.message || exception)
        }
    }
}

module.exports = DropOffOrders;
