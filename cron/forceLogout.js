'use strict';

require('../bin/db')(process.env.NODE_ENV);
const { forceLogoutWebUser } = require('../models/authToken');

(async function () {
    try {
        //source 1 for web login
        await forceLogoutWebUser(1);
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
})();
