const yup = require('yup');

const validateUser = () => {

    return yup.object().shape({
        name: yup.string().required().min(3).max(20),
        contact_number: yup.number().positive().min(10).max(10).required(),
        address: yup.string().required().min(10).max(254),
        // hub_city: yup.array().required(),
        hub_id: yup.array().required(),
        role_id: yup.number().required(),
        password: yup.string().required().min(6),
        profile_picture_file: yup.string().required(),
        profile_picture_type: yup.string().required(),
        app_access: yup.number().required()
    })
}

const validatePassword = () => {
	return yup.object().shape({
		new_password: yup
			.string()
			.required()
			.min(6)
			.test('password-validation', 'Invalid password', (value) => {
				const lowercaseValue = value.toLowerCase();
				return validPasswordRegex.test(lowercaseValue);
			}),
		confirm_password: yup
			.string()
			.required()
			.min(6)
			.test('password-validation', 'Invalid password', (value) => {
				const lowercaseValue = value.toLowerCase();
				return validPasswordRegex.test(lowercaseValue);
			}),
	});
};


const validPasswordRegex = /^(?!.*(?:shypmax|shyplite|shyptrack)).{6,}$/;

const validPassword = yup.object({
    body: yup.object({
        password: yup
            .string()
            .required()
            .test('password-validation', 'Invalid password', (value) => {
                const lowercaseValue = value.toLowerCase();
                return validPasswordRegex.test(lowercaseValue);
            })
    })
});

const validateForceLogoutUserId = yup.object({
    body: yup.object({
        user_id: yup.number("User Id must be a number")
            .required('User Id not found')
            .integer('User Id must be an integer')
            .positive('User Id must be a positive number'),
        app_access: yup.number("Source must be a number")
            .required('Source not found')
            .integer('Source must be an integer')
            .positive('Source must be a positive number')
            .oneOf([1, 2], 'Source must be either 1 or 2')
    })
});

const validatePhoneNo = yup.object({
    body: yup.object({
        contact_number: yup.string().length(10).required('Phone no. not found'),
        source: yup.number().required('Source not found'),
        password: yup.string().required('Password not found')
    })
});


module.exports = { validateUser, validatePassword, validateForceLogoutUserId, validatePhoneNo, validPassword }
