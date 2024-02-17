"use strict";

const STOCK_MODEL = require('../models/stock')
const HUB_MODEL = require('../models/hub');
const CsvWriter = require('../modules/csvWriter');
const os = require("os");
const dayjs = require('dayjs');
const S3_MODULE = require('../modules/s3');

const schema = [
    {header: "Hub Code", key:"code"},
    {header: "Hub City", key: "city"},
    {header: "Available Bag Count", key: "available_bag_count"},
    {header: "Available Seal Count", key: "available_seal_count"},
    {header : "Added On", key : "stock_added_date"}
    

];


const BATCH_SIZE = 100;

class STOCK {

    static DEFAULT_PAGE = 1;
    static DEFAULT_LIMIT = 25;


    async insertStockData(hub_id, bag_count, seal_count ) {
        try {
            if(!hub_id)
                throw new Error("Hub id not found");

            let inserObj = {
                hub_id : hub_id, 
                bag_count : bag_count,
                seal_count : seal_count,
                stock_added_date : new Date()
            }

            await STOCK_MODEL.addStock(inserObj);
          
            await HUB_MODEL.updateBagSealCount(hub_id, Number(bag_count), Number(seal_count))

            return true ;
        }
        catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async getStockData( filters ) {

        try {
            let hasNext = false, hasPrev = false;
            const page = parseInt(filters.page ?? STOCK.DEFAULT_PAGE);
            let limit = parseInt(filters.offset ?? STOCK.DEFAULT_LIMIT);

            const offset = (page - 1) * limit;

            let result = await STOCK_MODEL.getStockData(offset, limit + 1, filters);

            if (result.length == limit + 1) {
                hasNext = true;
            }

            if (page > 1) {
                hasPrev = true;
            }

            result = result.slice(0, limit);

            return { data: result, hasNext, hasPrev };
        }
        catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async getSingleStockData( id ) {

        try {
            let result = await STOCK_MODEL.getStockDataByID( id )

            return result;
        }
        catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async editStock(hub_id, bag_count, seal_count, id ) {
        try {

            if(!hub_id)
                throw new Error("Hub not found");
            
            if(!id)
                throw new Error("Bag not found");

            let inventoryData = await STOCK_MODEL.getInventoryData(id)

            let { bag_count_db, seal_count_db, hub_id : hub_id_db} = inventoryData[0];

            await HUB_MODEL.updateBagSealCount(hub_id_db, Number(-bag_count_db), Number(-seal_count_db))
            //in above logic we first deduct all qty from hub available stock

            let updateObj = {
                bag_count : bag_count,
                seal_count : seal_count,
                stock_update_date : new Date(),
                hub_id : hub_id
            }
            await STOCK_MODEL.editStock(updateObj, id);
            
            await HUB_MODEL.updateBagSealCount(hub_id, Number(bag_count), Number(seal_count))

            return true;
        }
        catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

    async getBagInventoryExport( filters, user_id ) {
        try {

            const queryString = await HUB_MODEL.getBagInventoryDataForExport( filters, user_id );

            const connection = await readDB.getConnection();

            const csv = new CsvWriter()

            const fileName = `bag_inventory_export-${dayjs(new Date()).format('DD-MMM-YYYY')}-${Date.now()}.csv`;
            
            const filePath = `${os.tmpdir()}/${fileName}`;

            await csv.initialize({schema, filePath})

            let bag_inventory_arr = [];

            const addRows = async (data) => {

                data = data.map(i => {
                    i.available_bag_count = i?.available_bag_count ? i?.available_bag_count : '-';
                    i.available_seal_count = i?.available_seal_count ? i?.available_seal_count : '-';
                    i.code = i?.code ? i?.code : '-';
                    i.city = i?.city ? i.city : '-';
                    i.stock_added_date = i?.stock_added_date ? dayjs(i?.stock_added_date).format('DD-MM-YYYY') : '-'

                    return i
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

                    bag_inventory_arr.push(i);

                    if (bag_inventory_arr.length < BATCH_SIZE)
                        return

                    connection.pause();

                    await addRows(bag_inventory_arr, csv)

                    bag_inventory_arr = []

                    connection.resume();
                })
                .on('end', async () => {
                    connection.release();

                    if (bag_inventory_arr.length > 0) {

                        await addRows(bag_inventory_arr, csv)
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
            throw new Error(exception.message || exception)
        }
    }

    async getBagInventoryData( filters, user_id ) {

        try {
            let hasNext = false, hasPrev = false;
            let page = parseInt(filters.page ?? STOCK.DEFAULT_PAGE);
            let limit = parseInt(filters.offset ?? STOCK.DEFAULT_LIMIT);

            let offset = (page - 1) * limit;

            let result = await HUB_MODEL.getBagInventoryData(offset, limit + 1, filters, user_id);

            if (result.length == limit + 1) {
                hasNext = true;
            }

            if (page > 1) {
                hasPrev = true;
            }

            result = result.slice(0, limit);

            return { data: result, hasNext, hasPrev };
        }
        catch (exception) {
            throw new Error(exception.message || exception)
        }
    }

}



module.exports = STOCK;