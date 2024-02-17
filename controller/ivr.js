"use strict";

const { getContactDetails } = require('../models/pickup_request');
const { ivrCalling } = require('../modules/ivr');
class Ivr {

    async ivrCall(routeReqAssignedId) {
        try {
            const { sellerNumber, riderNumber } = (await getContactDetails(routeReqAssignedId))[0];
            await ivrCalling(riderNumber, sellerNumber)
        }
        catch (exception) {
            throw exception;
        }
    }
}


module.exports = Ivr;