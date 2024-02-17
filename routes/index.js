"use strict";
const { Router } = require('express');
const router = Router();

const { auth } = require('../modules/auth');

const hub = require('./hub')
const usersAuth = require('./users/userAuth')
const user = require('./users/users')
const roles = require('./roles')
const orders = require('./orders')
const serviceability = require('./serviceability')
const routeAssignment = require('./routeAssignment')
const dashboard = require('./dashboard')
const inscan = require('./inscan')
const inventory = require('./inventoryRecon')
const inbound = require('./inbound')
const bagging = require('./bagging')
const riderApp = require('./riderApp')
const failure = require('./failureReason')
const pickupVerify = require('./pickupVerify')
const transporter = require('./transporter')
const maps = require('./map');
const orderReceive = require('./orderReceive');
const outscan = require('./outscan')
const reports = require('./reports');
const orderDelivery = require('./orderDelivery')
const linehaul = require('./linehaul')
const vehicle = require('./vehicle');
const stock = require('./stock');
const confirmSnsSubscription = require('./confirmSnsSubscription');
const riderTracking = require('./riderTracking');
const analytics = require('./analytics')
const notification = require('./notification');
const ivr = require('./ivr');
const appSetting = require('./appSetting');
const autoAssign = require('./autoAssign');
const zoneMapping = require('./zoneMapping');
const appNotification = require('./appNotification');

let pingResponseCode = 200;
router.get('/ping', (req, res) => {
	res.status(pingResponseCode).send('OK');
});
router.get('/startdeployment', (req, res) => {
	// 418 makes the instance unhealthy in ALB and disconnects traffic
	pingResponseCode = 418;
	res.send('OK');
});
// Dedicated pingdom route so the api doesn't show down during blue green deployment
router.get('/pingdom', (req, res) => {
	res.status(200).send('OK');
});

router.use(usersAuth);
router.use(serviceability);
router.use(orderReceive);
router.use(confirmSnsSubscription);
router.use(auth);
router.use(hub);
router.use(user);
router.use(roles);
router.use(orders);
router.use(routeAssignment);
router.use(inscan);
router.use(inbound);
router.use(bagging);
router.use(riderApp);
router.use(pickupVerify);
router.use(outscan);
router.use(vehicle);
router.use(orderDelivery);
router.use(notification);
router.use(riderTracking);
router.use(dashboard);
router.use(inventory);
router.use(failure);
router.use(transporter);
router.use(maps);
router.use(reports);
router.use(linehaul);
router.use(stock);
router.use(ivr);
router.use('/app-setting', appSetting);
router.use('/zone', zoneMapping);
router.use('/app-notification', appNotification);
router.use(analytics);
router.use('/auto-assign', autoAssign);

module.exports = router;
