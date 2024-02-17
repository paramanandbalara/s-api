'use strict';

const { getDataFromShypmax } = require('./shypmaxConfig');
const { saveOrUpdatePickupLocation } = require('./pickupLocation')
const shypmaxConfig = require('../../shyptrack-static/shypmax.json');
const ordersModel = require("../models/orders")

const fetchOrderDetailsFromShypmax =  async (awb) => {
    try {
        const { SX_GET_ORDER_DETAIL_URL } = shypmaxConfig;
        const url = `${SX_GET_ORDER_DETAIL_URL}/${awb}`;
        const [orderDetails] = await getDataFromShypmax(url, 'GET', {});
        if (!orderDetails) {
            throw new Error('Order not found or not belong to Shypmax');
        }
        return orderDetails;
    } catch (error) {
        throw new Error(`Order not found or not belong to Shypmax`);
    }
}

const getSellerEmail = async (sy_warehouse_id) => {
    try{
        const { SX_GET_SELLER_EMAIL_URL } = shypmaxConfig;
        const url = `${SX_GET_SELLER_EMAIL_URL}?sy_warehouse_id=${sy_warehouse_id}`;
        const sellerDetails = await getDataFromShypmax(url, 'GET', {});
        if(sellerDetails){
            return sellerDetails
        }
        return undefined;
    }catch (error) {
        console.log(__line, error)
        throw new Error(`Error while getting seller email`);
    }
}
const saveOrderDetailsToDatabase =  async (orderDetails, hubId) => {
    try {
        const {
            shypmax_id,
            awb: orderAwb,
            seller_id,
            manifest_id,
            mps_master_child,
            order_number,
            sy_order_id,
            sy_warehouse_id,
            order_date,
            mode: modeName,
            package_length,
            package_width,
            package_weight,
            package_height,
            package_value,
        } = orderDetails;

        const orderData = {
            shypmax_id : shypmax_id.trim(),
            awb : orderAwb.trim(),
            seller_id,
            manifest_id,
            mps_master_child,
            order_number,
            sy_order_id,
            sy_warehouse_id,
            order_date,
            mode : modeName,
            package_length,
            package_width,
            package_weight,
            package_height,
            package_value,
            status : 0,
            hub_id: hubId,
            order_receive_date : new Date()
        }
        
        const saveOrderDetails = await ordersModel.saveOrderDetails(orderData);
        const saveWarehouseDetails = await saveOrUpdatePickupLocation(orderDetails)
        return saveOrderDetails;
    } catch (error) {
        throw new Error(`Error saving order details to database: ${error.message}`);
    }
}

const fetchAndSaveOrderDetails =  async (awb, hubId) => {
    try {
        const orderDetails = await fetchOrderDetailsFromShypmax(awb);
        const saveOrderDetails = await saveOrderDetailsToDatabase(orderDetails, hubId);
        const getOrderDetails = await ordersModel.checkWhetherAwbExist(awb)
        return getOrderDetails;
    } catch (error){
        throw new Error(`${error.message}`);
    }
}
    
module.exports = { fetchAndSaveOrderDetails, getSellerEmail }