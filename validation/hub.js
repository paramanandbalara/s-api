const yup = require('yup');

const validateHub = () => { 

    return yup.object().shape({
        code: yup.string().required().min(1).max(10),
        name: yup.string().required().min(3).max(30),
        city: yup.string().required().min(3).max(20),
        address: yup.string().trim().required().min(10).max(254),
        contact_name: yup.string(),
        contact_number: yup.string(),
        email: yup.string(),
        gateway_code: yup.string(),
        state: yup.string().required(),
        pincode: yup.number().positive().integer()
            .typeError('Hub pincode must be a number')
            .required('Hub pincode is required')
            .test('is-six-digits', 'Hub pincode must exactly be of 6 digits', val => (val && val.toString().length === 6))
    })
}

const validatePincode = () => {
    return yup.object().shape({
        pincode: yup.string().min(6, 'Pincode must exactly be of 6 digits').max(6, 'Pincode must exactly be of 6 digits').typeError('Pincode must be a number').required('Pincode is required'),
    })
}


module.exports = { validateHub,validatePincode }
