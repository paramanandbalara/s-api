"use strict";
const fs = require('fs');
const es6views = require('es6views');
const path = require('path');
const pdf = require('html-pdf');

const es6viewsParser = async(path, data) => {

    return new Promise((resolve, reject) => {

        es6views.parser(path, data, (err, result) => {

            if (err)
                return reject(err)

            resolve(result)
        })
    })
}

const appendEs6FileOnHtml = async (location, data) => {

    const ensureDirectoryExistence = filePath => {
        let dirname = path.dirname(filePath)
        if (fs.existsSync(dirname)) {
            return true
        }
        ensureDirectoryExistence(dirname)
        fs.mkdirSync(dirname)
        return true
    }

    return new Promise((resolve, reject) => {
        if (!ensureDirectoryExistence(location))
            return reject(new Error("Unable to check or create parent directory of " + location))

        fs.writeFile(location, data, errx => {
            if (errx)
                return reject(errx)

            resolve(true)
        })
    })
}

const getSlipHtmlToPDF = async (htmlPath, pdfPath) => {
    return new Promise((resolve, reject) => {
        let html = fs.readFileSync(htmlPath, 'utf8')
        let options = {
            width: '14.3in',
            height: '21.07in',

            "border": {
                "top": "0in",            // default is 0, units: mm, cm, in, px
                "right": "0in",
                "bottom": "1.5in",
                "left": "0in"
            },
            paginationOffset: 1,       // Override the initial pagination number
        }
        pdf.create(html, options).toFile(pdfPath, (err, res) => {
            if (err) {
                return reject(err)
            }
            resolve(res)
        })
    })
}

module.exports = { es6viewsParser, appendEs6FileOnHtml, getSlipHtmlToPDF }
