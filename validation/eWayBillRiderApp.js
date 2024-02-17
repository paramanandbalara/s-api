"use strict"
const Yup = require('yup');


const eWayBillRiderApp = Yup.object({
    body: Yup.object({
        eway_billno: Yup.string().required("E-way bill number not found").trim(),
        awb: Yup.string().required('Awb not found').trim()
    })

})


module.exports = { eWayBillRiderApp }