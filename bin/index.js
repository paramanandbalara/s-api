'use strict';

// let gracefulShutDownCalled = false;
// process.on('SIGINT', gracefulShutdown);
// process.on('SIGTERM', gracefulShutdown);
// process.on('uncaughtException', handleUncaughtException);
// process.on('unhandledRejection', handleUnhandledRejection);

const app = require('../app');
const serve = require('./www');


const httpServer = serve(app, onServerClosed);

/**
 * This function is called when the application receives SIGINT or SIGTERM signal from the OS.
 * This function is gracefully closes the http server.
 * @param {String} signal   Value of the signal responsible for shutdown
 * @return {void}
 */
async function gracefulShutdown(signal = null) {
  gracefulShutDownCalled = true;
  signal !== null && console.log(`Received ${signal}`);
  console.log('Gracefully shutting down');
  try {
    httpServer.close();
  } catch (err) {
    console.error(`Error in closing httpServer ${err}`);
    try {
      await onServerClosed();
    } catch (err) {
      console.error(`onServerClosed err ${err}`);
      process.exit(-1);
    }
  }
}

/**
 * This function is called when there is an uncaught exception in the application.
 * @param {Error} err
 * @param {Object} origin
 * @return {Promise<void>}
 */
async function handleUncaughtException(err, origin) {
  console.error(`Uncaught exception ${err}\nException origin ${origin}`);
  try {
    true === gracefulShutDownCalled ? await onServerClosed() : gracefulShutdown();
  } catch (err) {
    console.log('Error in gracefulShutdown', err);
    console.log('Executing onServerClosed');
    await onServerClosed();
  }
}

/**
 * This function is called when there is an unhandled rejection in the application.
 * @param {Error} reason
 * @param {Object} promise
 * @return {Promise<void>}
 */
async function handleUnhandledRejection(reason, promise) {
  console.error(`Unhandled rejection at ${promise}\nReason ${reason}`);
  try {
    true === gracefulShutDownCalled ? await onServerClosed() : gracefulShutdown();
  } catch (err) {
    console.log('Error in gracefulShutdown', err);
    console.log('Executing onServerClosed');
    await onServerClosed();
  }
}

/**
 * This function is called once the http server is closed.
 * It gracefully disconnects the db connections and in case of any error in this forcefully terminates the same.
 * It stops all running consumers.
 * Then it calls exit of process with 0 as its argument.
 * @return {Promise<void>}
 */
async function onServerClosed() {
  console.log('HTTP server closed');
  const existingDbConnections = {};
  try {
    readDB;
    existingDbConnections.readDB = readDB;
  } catch (err) {
    console.log(`Error accessing readDB ${err}`);
  }

  try {
    writeDB;
    existingDbConnections.writeDB = writeDB;
  } catch (err) {
    console.log(`Error accessing writeDB ${err}`);
  }

  await Promise.allSettled([
    Promise.allSettled(
        Object.entries(existingDbConnections).map(
            ([connName, connObj]) => connObj.end()
                .then(() => `${connName} closed`)
                .catch((err) => connObj.destroy().then(() => `${connName} forcefully disconnected`)),
        ),
    )
        .then((result) =>
          result
              .map(({value}) => `${value}`)
              .join('\n'),
        ),
  ])
      .then((result) =>
        console.dir(
            result
                .map(({value}) => `${value}`)
                .join('\n')
            , {depth: null}),
      );
  process.exit(0);
}
