
const inventoryModel = require('../models/inventoryRecon')
const CsvWriter = require('../modules/csvWriter');
const os = require("os");
const moment = require('moment');
const s3Module = require('../modules/s3');
const {getUser} = require('../models/users')
const {sendEmail} = require('../modules/sendEmail');
const dayjs = require('dayjs');

const SCHEMA = [
    { header: "AWB", key: "awb", coerceString: true },
    { header: "Hub Code", key: "hub_code" },
    { header: "Hub City", key: "hub_city" },
    { header: "Drop Off Hub Code", key: "dropoff_hub_code" },
    { header: "Drop Off Hub City", key: "dropoff_hub_city" },
    { header: "Weight", key: "weight" },
    { header: "Value", key: "value" },
    { header: "Received On", key: "received_on", coerceString: true },
    { header: "Pickup On", key: "pickup_date", coerceString: true },
    { header: "In Scan Date", key: "in_scan_date", coerceString: true },
    { header: "Bag Date", key: "bagged_date", coerceString: true },
    { header: "Out Scan Date", key: "outscan_date", coerceString: true },
    { header: "Bag Inbound Date", key: "inbound_bag_date", coerceString: true },
    { header: "AWB Inbound Date", key: "inbound_date", coerceString: true },
    { header: "Bag Code", key: "bag_code" },
    { header: "Bag Seal No.", key: "bag_sealno" },
    { header: "Transporter Name", key: "transporter_name" },
    { header: "Linehaul AWB", key: "transporter_awbno", coerceString: true },

];

const BATCH_SIZE = 100;

class InventoryRecon {
    static DEFAULT_PAGE = 1;
    static DEFAULT_LIMIT = 25;

    async getInScannedAwbsCount(filters) {
        try {
            const hubId = this.hubIdValidateFun(filters.hub_id);
            // 5 - inscan
            return inventoryModel.getAwbsCount(5, hubId , filters,);
        }
        catch (error) {
            throw error;
        }
    }

    async getBaggedAwbsCount(filters) {
        try {
            const hubId = this.hubIdValidateFun(filters.hub_id);
            // 6 -- bagging
            return inventoryModel.getAwbsCount(6, hubId, filters);
        }
        catch (error) {
            throw error;
        }
    }

    async getOutScannedAwbsCount(filters) {
        try {
            const hubId = this.hubIdValidateFun(filters.hub_id);
            // 7 - outscan
            return inventoryModel.getAwbsCount(7, hubId, filters);
        }
        catch (error) {
            throw error;
        }
    }

    formatDate(date) {
        return moment(date).format('YYYYMMDD');
    }

    async getInventoryData(filters) {
        try {
            const hubId = this.hubIdValidateFun(filters.hub_id);
            const pageNumber = parseInt(filters.page ?? InventoryRecon.DEFAULT_PAGE);
            const pageSize = parseInt(filters.offset ?? InventoryRecon.DEFAULT_LIMIT);
            const startIndex = (pageNumber - 1) * pageSize;
            const date = this.formatDate(filters.startDate);

            const inventoryData = await inventoryModel.getInventoryData({ filters, offset: startIndex, limit: pageSize + 1, hubId });
            if (!inventoryData.length) {
                return { data: [], hasNext: false, hasPrev: false };
            }

            const awbs = inventoryData.map(item => item.awb);
            const pickupData = await inventoryModel.getOrderEventsByAwbs(awbs, 4);

            const inventoryDataFormatted = inventoryData.map(item => {
                const { in_scan_date, outscan_date } = item;
                const formattedInScanDate = this.formatDate(in_scan_date);
                const formattedOutscanDate = this.formatDate(outscan_date);

                return {
                    ...item,
                    in_scan_date: formattedInScanDate === date ? in_scan_date : null,
                    outscan_date: formattedOutscanDate === date ? outscan_date : null,
                    pickup_date: pickupData.find(pickupItem => pickupItem.awb === item.awb)?.event_created_at || null
                };
            });

            const hasNext = inventoryDataFormatted.length > pageSize;
            const hasPrev = pageNumber > 1;
            const inventoryDataPaginated = inventoryDataFormatted.slice(0, pageSize);

            return { data: inventoryDataPaginated, hasNext, hasPrev };
        } catch (error) {
            throw error;
        }
    }

    async getInventoryExport(filters) {
        try {
            const {monthwise, user_id, startDate, hub_id} = filters;
            const hubId = this.hubIdValidateFun(hub_id);
            const queryString = await inventoryModel.getInventoryData({filters, hubId, exportReport: true});
            const connection = await readDB.getConnection();
            const csv = new CsvWriter();
            const fileName = `inventory_export-${moment(new Date()).format("DD-MMM-YYYY")}-${Date.now()}.csv`;
            const filePath = `${os.tmpdir()}/${fileName}`;

            await csv.initialize({ schema: SCHEMA, filePath });

            await this.processInventoryData({ connection, queryString, csv, filePath, startDate, monthwise });

            const signedURL = await this.uploadCsvToS3(fileName, filePath);

            if(monthwise){
                this.sendEmailInventoryExport({user_id, signedURL})
            }else{
                return signedURL;
            }
            
        } catch (error) {
            console.error(__line, error)
            throw error;
        }
    }

    async processInventoryData({ connection, queryString, csv, filePath, startDate, monthwise }) {
        const inventoryRows = [];
        const date = this.formatDate(startDate);

        const addRows = async (data) => {
            const awbs = data.map((item) => item.awb);
            let eventsDate = await inventoryModel.getOrderEventsDates(awbs);
            const pickupEvents = [];
            const baggedEvents = [];
            const inboundEvents = [];
            eventsDate.forEach(i => {
                i.status === 4 ? pickupEvents.push(i) : i.status === 6 ? baggedEvents.push(i) : inboundEvents.push(i)
            })
            const pickupEventsObj = pickupEvents.reduce((acc, cur) => {
                acc[cur.awb] = cur;
                return acc;
            }, {})
            const baggedEventsObj = baggedEvents.reduce((acc, cur) => {
                acc[cur.awb] = cur;
                return acc;
            }, {})
            const inboundEventsObj = inboundEvents.reduce((acc, cur) => {
                acc[cur.awb] = cur;
                return acc;
            }, {})

            const formattedData = data.map((row) => {
                const { in_scan_date, outscan_date, gateway_inscan_date } = row;
                const inboundDate = inboundEventsObj[row.awb]?.event_created_at || null;
                const baggedDate = baggedEventsObj[row.awb]?.event_created_at || null;

                if (monthwise) {
                    return {
                        ...row,
                        in_scan_date: in_scan_date,
                        outscan_date: outscan_date,
                        pickup_date: pickupEventsObj[row.awb]?.event_created_at,
                        bagged_date: baggedDate,
                        inboundDate: inboundDate,
                        inbound_bag_date: gateway_inscan_date
                    };
                } else {
                    const formattedBagInboundDate = this.formatDate(gateway_inscan_date);
                    const formattedInScanDate = this.formatDate(in_scan_date);
                    const formattedOutscanDate = this.formatDate(outscan_date);
                    const formattedBagDate = this.formatDate(baggedDate);
                    const formattedInboundDate = this.formatDate(inboundDate);
                    return {
                        ...row,
                        in_scan_date: formattedInScanDate === date ? in_scan_date : null,
                        outscan_date: formattedOutscanDate === date ? outscan_date : null,
                        pickup_date: pickupEventsObj[row.awb]?.event_created_at || null,
                        bagged_date: formattedBagDate === date ? baggedDate : null,
                        inboundDate: formattedInboundDate === date ? inboundDate : null,
                        inbound_bag_date: formattedBagInboundDate === date ? gateway_inscan_date : null
                    };
                }
            });

            formattedData.forEach((inv) => {
                const {
                    awb,
                    code,
                    city,
                    weight,
                    value,
                    received_on,
                    in_scan_date,
                    outscan_date,
                    pickup_date,
                    bag_code,
                    bag_sealno,
                    transporter_name,
                    bagged_date,
                    inboundDate,
                    transporter_awbno,
                    dropoff_hub_code,
                    dropoff_hub_city,
                    inbound_bag_date
                } = inv;
                
                const item = {
                    awb: awb ?? "-",
                    hub_code: code ?? "-",
                    hub_city: city ?? "-",
                    weight: weight ?? "-",
                    value: value ?? "-",
                    received_on: received_on
                        ? moment(received_on).utcOffset(330).format("DD-MM-YYYY hh:mm A")
                        : "-",
                    in_scan_date: in_scan_date
                        ? moment(in_scan_date).utcOffset(330).format("DD-MM-YYYY hh:mm A")
                        : "-",
                    outscan_date: outscan_date
                        ? moment(outscan_date).utcOffset(330).format("DD-MM-YYYY hh:mm A")
                        : "-",
                    pickup_date: pickup_date
                        ? moment(pickup_date).utcOffset(330).format("DD-MM-YYYY hh:mm A")
                        : "-",
                    bagged_date: bagged_date
                        ? moment(bagged_date).utcOffset(330).format("DD-MM-YYYY hh:mm A")
                        : "-",
                    inbound_date: inboundDate ? moment(inboundDate).utcOffset(330).format("DD-MM-YYYY hh:mm A")
                        : "-",
                    inbound_bag_date: inbound_bag_date ? moment(inbound_bag_date).utcOffset(330).format("DD-MM-YYYY hh:mm A")
                        : "-",
                    bag_code: bag_code ?? "-",
                    bag_sealno: bag_sealno ?? "-",
                    transporter_name: transporter_name ?? "-",
                    transporter_awbno: transporter_awbno || "-",
                    dropoff_hub_code: dropoff_hub_code || "-",
                    dropoff_hub_city: dropoff_hub_city || "-",
                };
                csv.writeRow(item)
            });

        };

        await new Promise((resolve, reject) => {
            connection.connection.query(queryString)
                .on("error", (err) => {
                    connection.release();
                    reject(err);
                })
                .on('result', async (inv) => {
                    inventoryRows.push(inv);

                    if (inventoryRows.length < BATCH_SIZE)
                        return;

                    connection.pause();
                    await addRows(inventoryRows);
                    inventoryRows.length = 0;

                    connection.resume();
                })
                .on('end', async () => {
                    connection.release();
                    if (inventoryRows.length > 0) {
                        await addRows(inventoryRows);
                    }
                    await csv.closeFile();
                    resolve();
                });
        });
    }

    async uploadCsvToS3(fileName, filePath) {
        try {
            const S3 = new s3Module();
            const key = `shyptrackreports/users/${fileName}`;
            await S3.uploadToS3('', key, filePath);
            const signedURL = await S3.getFilePath(key, 360);
            return signedURL;
        } catch (error) {
            console.error(__line, error)
            throw error;
        }
    }

    hubIdValidateFun(hubId) {
        try{
            // toString is being called because hub id can be of type number 
            // DANGER please do not remove toString
            hubId = hubId.toString().split(',').filter(hId => hId.length).map(Number); 
            if(!hubId.length) throw new Error ("Hub not found");
            return hubId
        }
        catch(exception){
            throw exception;
        }
    }

    async sendEmailInventoryExport({user_id, signedURL}) {
        try {
            const {email, name} = await getUser(user_id)
            const subject = `Shyptrack |  Inventory Reconciliation Export On ${dayjs(new Date()).format('DD MMMM YYYY')}`
            await sendEmail(email, name, 'shyptrack_inventory_export', {contentVars:signedURL, name}, subject )
        }
        catch(exception){
            console.error(exception);
            throw exception;
        }
    }
}

module.exports = InventoryRecon;