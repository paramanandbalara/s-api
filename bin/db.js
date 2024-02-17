'use strict';

const mysql = require('mysql2');

module.exports = function(env) {
  const dbCredentials = {
    host: process.env.sqlSHYPTRACKHOST,
    user: process.env.sqlSHYPTRACKUSER,
    password: process.env.sqlSHYPTRACKPASS,
    database: process.env.sqlSHYPTRACKDBNAME,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    // debug: 'development' === process.env.NODE_ENV ? ['ComQueryPacket', 'RowDataPacket'] : false,
  };

  console.log('writeDB', dbCredentials?.host ? 'connected' : 'environment variable not set');
  const writeDBPool = mysql.createPool(dbCredentials);

  if (env === 'production') {
    dbCredentials.host = process.env.sqlSHYPTRACKREADHOST;
    dbCredentials.connectionLimit = 5;
  }

  console.log('readDB', dbCredentials?.host ? 'connected' : 'environment variable not set');

  // pool connection
  const readDBPool = mysql.createPool(dbCredentials);

  Object.defineProperty(global, 'writeDB', {
    value: writeDBPool.promise(),
    configurable: false,
    enumerable: true,
    writable: false,
  });

  Object.defineProperty(global, 'readDB', {
    value: readDBPool.promise(),
    configurable: false,
    enumerable: true,
    writable: false,
  });
};
