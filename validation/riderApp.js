const yup = require('yup');

const validateInscanData = () => {

    return yup.object().shape({
        awb: yup.string().required(),
        device_id: yup.string().required(),
        lat_long: yup.string().required(),
    })
}
const validateCompleteScanData = () => {

    return yup.object().shape({
        awbs: yup.array().required()
    })
}


module.exports = { validateInscanData, validateCompleteScanData }
