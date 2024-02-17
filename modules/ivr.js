"use strict";
const { exotel_ivr } = require('../../shyptrack-static/stconfig.json');
const errorLogsModel = require('../models/error_logs');
const axios = require('axios');
const qs = require('qs');
const { checkAlreadyCallInitiatedData, insertIVRData } = require('../models/ivr');

const { account_sid, api_key, api_token, caller_id, subdomain } = exotel_ivr;

const ivrCalling = async (sourceNumber, destinationNumber) => {
    try {
        const [checkAlreadyCallInitiated] = await checkAlreadyCallInitiatedData(sourceNumber, destinationNumber);
        if (checkAlreadyCallInitiated) {
            throw new Error("Call already in progress, Try in few seconds");
        }

        await exotelAPICall(sourceNumber, destinationNumber);
        const date = new Date();
        // date.setMinutes(date.getMinutes() - 330)
        const ivrObject = {
            call_source: sourceNumber,
            call_destination: destinationNumber,
            call_date: date
        }
        await insertIVRData(ivrObject);
    }
    catch (err) {
        console.error("Error in calling", err.data || err.message);
        await errorLogsModel.insertErrorLog(null, JSON.stringify(err.data || err.message));
        throw err;
    }
}

const exotelAPICall = async (sourceNumber, destinationNumber) => {
    try {
        const data = qs.stringify({
            'From': Number(sourceNumber),
            'To': Number(destinationNumber),
            'CallerId': Number(caller_id)
        });

        const url = `https://${api_key}:${api_token}${subdomain}/v1/Accounts/${account_sid}/Calls/connect`

        const config = {
            method: 'post',
            url,
            data
        };

        await axios(config)
    }
    catch (exception) {
        throw exception;
    }
}

module.exports = { ivrCalling }
