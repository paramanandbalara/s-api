"use strict";

const XLSX = require('xlsx')

/**
 * Parse an XLS/X document at the given path and return a JSON object.
 * @constructor
 * @param  {String}       path path to XLS/X file. Store user uploaded files to: process.env.TMPDIR || /tmp/
 * @return {Promise}      Resolves with parsed object.
 */

 const xlsJSON = (path) => {
  if (!path || path.trim().length === 0) {
    throw new Error("An invalid or no path was provided for the XLSx file.");
  }

  let workbook;
  try {
    workbook = XLSX.readFile(path);
  } catch (error) {
    throw error;
  }

  let sheetsList = workbook.SheetNames;
  const data = [];

  sheetsList.forEach(function (sheetName) {
    let worksheet = workbook.Sheets[sheetName];
    let headers = {};
    let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (rows.length < 2) {
      // Skip empty sheets
      return;
    }

    let skipRow = false;
    rows.forEach((row, rowIndex) => {
      if (rowIndex === 0) {
        // Store header names
        headers = row.reduce((acc, header) => {
          if (header) {
            let cleanedHeader = header.toString().trim().replace(/\(.*\)/g, "").replace(/\s/g, "").toLowerCase();
            acc[cleanedHeader] = cleanedHeader;
          }
          return acc;
        }, {});
      } else if (!skipRow)  {
        let rowData = {};
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          let header = Object.keys(headers)[colIndex];
          let value = row[colIndex] || "";
          rowData[header] = value;
        }
        data.push(rowData);
      }
      const nextRow = rows[rowIndex + 1];
      skipRow = nextRow && nextRow.every(cell => !cell)

    });
  });

  return data;
};
  
  
module.exports = xlsJSON