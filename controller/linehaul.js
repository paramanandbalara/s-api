"use strict";

const LINEHAUL_MODEL = require('../models/linehaul')
const CsvWriter = require('../modules/csvWriter');
const os = require("os");
const moment = require('moment');
const S3_MODULE = require('../modules/s3');
const INBOUND_MODEL = require('../models/inbound')


const schema = [
    { header: "Origin Hub", key: "hub_code" },
    { header: "Origin City", key: "hub_city" },
    { header: "Gateway", key: "gateway_code" },
    { header: "Transport Name", key: "transporter_name" },
    { header: "Transport Mode", key: "transporter_mode" },
    { header: "Airway Bill No", key: "transporter_awbno" },
    { header: "Bag Count", key: "bag_count" },
    { header: "AWB Count", key: "inbound_awb_count" },
    { header: "Bag Weight(Kg)", key: "bag_weight" },
    { header: "Dispatch Date", key: "outscan_date", coerceString: true },
    { header: "Transit Days", key: "transit_days", coerceString: true },
    { header: "Inbound Date", key: "inbound_date", coerceString: true },
    { header: "Status", key: "status" }


];

const BATCH_SIZE = 100;
const MODE_ARR = ['', 'Air', 'Surface'];
class LineHaul {

    static DEFAULT_PAGE = 1;
    static DEFAULT_LIMIT = 25;

    async getLinehaulData({
        page = LineHaul.DEFAULT_PAGE,
        limit = LineHaul.DEFAULT_LIMIT,
        startDate = new Date(),
        endDate = new Date()
    }) {
        try {
            const offset = (page - 1) * limit;

            const linehaulData = await LINEHAUL_MODEL.getLinehaulData({ startDate, endDate, offset, limit: Number(limit) + 1 }, false);
            
            const processedData = this.linehaulFunction(linehaulData);

            processedData.forEach(item => {
                item.transporter_awbno = !(item.transporter_awbno.includes('temp-airway')) ? item.transporter_awbno : null;
            });

            const hasNext = processedData.length > limit;
            const hasPrev = page > 1;
            const trimmedData = processedData.slice(0, limit);

            return { data: trimmedData, hasNext, hasPrev };
        } catch (exception) {
            throw new Error(exception);
        }
    }

    async getLinhaulManifestDataExport({ startDate = new Date(), endDate = new Date() }) {
        try {
            const result = await LINEHAUL_MODEL.getLinehaulData({ startDate, endDate }, false);
            const bagIds = result.map(item => item.id);

            if (bagIds.length === 0) {
                throw new Error("No data found");
            }

            const promises = [
                INBOUND_MODEL.getAwbCountByBagId(bagIds),
                INBOUND_MODEL.getAwbCountByBagId(bagIds, 11)
            ];

            const [inboundAwbCount, expectedAwbCount] = await Promise.allSettled(promises)
                .then(results => results.map(result => result.status === 'fulfilled' ? result.value : result.reason));

            const csv = new CsvWriter();
            const fileName = `linehaul-manifest-${moment(new Date()).format('DD-MMM-YYYY')}-${Date.now()}.csv`;
            const filePath = `${os.tmpdir()}/${fileName}`;

            await csv.initialize({ schema, filePath });

            const data = this.linehaulFunction(result, inboundAwbCount, expectedAwbCount, true);

            data.forEach(item => {
                item.transporter_awbno = item.transporter_awbno.includes('temp-airway') ? '-' : item.transporter_awbno;
                csv.writeRow(item);
            });

            const S3 = new S3_MODULE();
            const key = `shyptrackreports/users/${fileName}`;

            await S3.uploadToS3('', key, filePath, { contentType: 'text/csv' });

            const signedURL = await S3.getFilePath(key, 360);

            return signedURL;
        } catch (exception) {
            console.error(__line, exception);
            throw new Error(exception);
        }
    };


    async getTransporterAWBImage(awb) {
        try {

            const S3classInstance = new S3_MODULE();

            let filePath = `airway-bill/${awb}`;
            let allFiles = await S3classInstance.getAllFiles(filePath);

            if (!allFiles.length) {
                throw new Error("No image found");
            }
            filePath = allFiles[0].Key;
            let filepath = await S3classInstance.getFilePath(filePath);

            return { filepath };

        }
        catch (exception) {
            console.error(__line, exception);
            throw new Error(exception);
        }

    }

    async getTransporterAWBDetails(bagIds) {
        try {

            bagIds = bagIds.split(',').map(Number);

            if (!bagIds.length) return []

            return LINEHAUL_MODEL.getTransporterAWBDetails(bagIds);

        }
        catch (exception) {
            console.error(__line, exception);
            throw exception;
        }

    }

    linehaulFunction(result, inboundOrders = [], expectedOrders = [], isExport = false) {
        try {
            const bagCountDict = {};
            const bagWeight = {}
            const transitDays = {}
            const inbound_awb_order = {}
            const expected_awb_order = {}

            expectedOrders = expectedOrders.reduce((result, item) => {
                result[item.bag_id] = item;
                return result;
            }, {});

            inboundOrders = inboundOrders.reduce((result, item) => {
                result[item.bag_id] = item;
                return result;
            }, {});

            for (let item of result) {
                item['expected_awb_count'] = expectedOrders[item.id]?.orderCount || 0
                item['inbound_awb_count'] = inboundOrders[item.id]?.orderCount || 0

            }
            result.forEach(({ transporter_awbno: awbno, outscan_date, inbound_date, inbound_awb_count, bag_weight, expected_awb_count, transporter_name }) => {
                const key = awbno + transporter_name + this.formatDateForKey(outscan_date);
                const date1 = outscan_date ? new Date(outscan_date) : null;
                const date2 = inbound_date ? new Date(inbound_date) : null;
                if (date1 && date2) {
                    const diffTime = Math.abs(date2 - date1);
                    const diffMin = Math.ceil(diffTime / (1000 * 60))
                    const quotient = parseInt(diffMin / 60);
                    const minutes = parseInt(diffMin % 60);
                    const hours = parseInt(quotient % 24);
                    const days = parseInt(quotient / 24);
                    transitDays[key] = `${days}day(s) ${hours}hour(s) ${minutes}min(s)`;
                }
                inbound_awb_order[key] = (inbound_awb_order[key] || 0) + Number(inbound_awb_count) || 0;
                bagWeight[key] = (bagWeight[key] || 0) + Number(bag_weight);
                bagCountDict[key] = (bagCountDict[key] || 0) + 1;
                expected_awb_order[key] = (expected_awb_order[key] || 0) + Number(expected_awb_count) || 0;
            })

            const transporterWiseData = {}

            for (let { transporter_awbno: awbno,
                transporter_name, inbound_date,
                inbound_awb_count, hub_code, hub_city,
                gateway_code, transporter_mode,
                outscan_date, expected_awb_count,
                id: bagId } of result) {
                const key = awbno + transporter_name + this.formatDateForKey(outscan_date);
                if (isExport) {
                    outscan_date = outscan_date ? moment(outscan_date).utcOffset(330).format("DD-MM-YYYY hh:mm:ss A") : '';
                    inbound_date = inbound_date ? moment(inbound_date).utcOffset(330).format("DD-MM-YYYY hh:mm:ss A") : '';
                }
                if (!transporterWiseData.hasOwnProperty(key)) {

                    const inboundDates = result
                        .filter(x => x.transporter_awbno === awbno)
                        .map(x => x.inbound_date);

                    let status;
                    if (inbound_awb_count != expected_awb_count && inboundDates.every(x => x !== null)) {
                        status = 'Short Order'
                    }
                    else if (inboundDates.every(x => x !== null)) {
                        status = 'Delivered'
                    }
                    else if (inboundDates.every(x => x === null)) {
                        status = "In-Transit"
                    }
                    else if (result.some(bag => bag.inbound_date !== null)) {
                        status = "Short Bag"
                    }

                    transporterWiseData[key] = {
                        hub_code: hub_code || '-',
                        hub_city: hub_city || '-',
                        gateway_code: gateway_code || '-',
                        transporter_name: transporter_name || '-',
                        transporter_mode: MODE_ARR[transporter_mode] || '-',
                        transporter_awbno: awbno || '-',
                        outscan_date: outscan_date ? outscan_date : '',
                        inbound_date: inbound_date ? inbound_date : '',
                        bag_count: bagCountDict[key] || '-',
                        bag_weight: bagWeight[key]?.toFixed(2) || '-',
                        status: status || '-',
                        transit_days: transitDays[key] || '-',
                        inbound_awb_count: inbound_awb_order[key] || '-',
                        bagIds: `${bagId}`
                    }
                } else {
                    const transporterData = transporterWiseData[key];
                    if (!transporterData.inbound_date && inbound_date) {
                        transporterData.inbound_date = inbound_date;
                    }
                    transporterData.bagIds = `${transporterData.bagIds},${bagId}`;
                }

            }

            return Object.values(transporterWiseData);

        }
        catch (exception) {
            console.error(__line, exception);
            throw exception;
        }
    }

    formatDateForKey(date) {
        return moment(date).format('YYYYMMDDD')
    }


}

module.exports = LineHaul;