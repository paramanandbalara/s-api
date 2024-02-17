const express = require('express')
const router = express.Router();
const APP_AUTH = require('../modules/authorization/appAuth')
const HUB_CONTROLLER = require('../controller/hub')
const { validatePincode } = require('../validation/hub')

router.post('/checkServiceability', APP_AUTH.isAppAuthorized, async (req, res, next) => {
    try {

        await validatePincode().validate(req.body);

        const HUB = new HUB_CONTROLLER()
        const { type, pincode } = req.body;
        const RESULT = await HUB.checkPincodeServiceabilty(type, pincode)

        return res.send({ success: true, RESULT });
    } catch (error) {
        console.error(error)
        return res.send({ success: false, message: error?.message || error });
    }
})

module.exports = router;