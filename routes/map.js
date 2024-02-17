const express = require('express');
const router = express.Router()

router.get('/map/rider/tracking', async (req, res, next) => {
    try {

        res.send({ success: true });

    } catch (exception) {

        console.error(exception.message || exception)

        res.send({ success: false, message: exception.message || exception });

    }
})


module.exports = router;
