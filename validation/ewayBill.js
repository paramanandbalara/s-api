
const Yup = require('yup');

const validateEwayBillAdd = Yup.object().shape({
    body: Yup.object().shape({
        eway_billno: Yup.string().required("E-way bill number not found").trim(),
        eway_bill_img: Yup.string().required('E-way bill image not found'),
        eway_bill_img_type: Yup.string().required('E-way bill image type not found').matches(/^(jpg|jpeg|png|pdf)$/, 'Invalid e-way bill image type'),
        shypmax_id: Yup.string().required('Shypmax Id not found').matches(/^(SHPMX|SHCLB)\w*$/, 'Invalid shypmax id').trim(),
        id: Yup.number("Order Id must be a number").required('Order Id not found').integer('Order Id must be an integer').positive('Order Id must be a positive number')
    })
})




const validateEwayBillEdit = Yup.object().shape({
    body: Yup.object().shape({
        eway_billno: Yup.string().required("E-way bill number not found").trim(),
        shypmax_id: Yup.string().required('Shypmax Id not found').matches(/^(SHPMX|SHCLB)\w*$/, 'Invalid shypmax id').trim(),
        id: Yup.number("Order Id must be a number").required('Order Id not found').integer('Order Id must be an integer').positive('Order Id must be a positive number')
    })
})


module.exports = { validateEwayBillAdd, validateEwayBillEdit }