const express = require('express');
const router = express.Router()
const LINEHAUL_CONTROLLER = require('../controller/linehaul')

router.get('/linehaul', async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        const filters = { startDate, endDate };

        const LINEHAUL = new LINEHAUL_CONTROLLER();

        const result = await LINEHAUL.getLinehaulData(filters);
        res.send({ success: true, data: result.data, message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/linehaul/awb/image', async (req, res, next) => {
    try {

        const { transporter_awbno } = req.query;

        const LINEHAUL = new LINEHAUL_CONTROLLER();

        const result = await LINEHAUL.getTransporterAWBImage(transporter_awbno);

        res.send({ success: true, filepath: result.filepath, message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})

router.get('/linehaul/details', async (req, res, next) => {
    try {

        let { bagIds } = req.query;

        const LINEHAUL = new LINEHAUL_CONTROLLER();

        const result = await LINEHAUL.getTransporterAWBDetails(bagIds);

        res.send({ success: true, data: result, message: 'Data Retrieved' });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})



module.exports = router;
