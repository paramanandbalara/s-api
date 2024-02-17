const express = require('express');
const bodyParser = require('body-parser');

const routes = require('./routes/index');
const getRoute = require('./modules/endpoints');
const refreshRoutes = require('./bin/refreshRoutes');
const bootstrap = require('./bin/bootstrap');
const app = express();
bootstrap(app);
const NODE_ENV = process.env.NODE_ENV;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(routes);

global.setRoutes = new Set();
app._router.stack.forEach(getRoute.print.bind(null, []));

setImmediate(async () => {
  try {
    await refreshRoutes.initializeRoutes();
  } catch (err) {
    console.error(err);
  }
});

global.urls = app._router.stack
  .filter((r) => r.route)
  .map((r) => r.route.path);


if (NODE_ENV === 'production' || NODE_ENV === 'staging') {
  const { fetchOrdersFromSns } = require('./modules/fetchOrdersFromShyptrackQueue');
  const { fetchAndSaveOrders } = require('./modules/fetchOrderNew');
  const { fetchNonManifestedOrders } = require('./modules/orderReceive');
  const { readEventsFromQueue } = require('./modules/eventPushShypmax');
 
  fetchOrdersFromSns();
  fetchAndSaveOrders();
  fetchNonManifestedOrders();
  readEventsFromQueue();
}

module.exports = app;
