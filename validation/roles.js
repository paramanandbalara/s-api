const yup = require('yup');

const validateRole = () => {

    return yup.object().shape({
        name: yup.string().required('Role name not defined').min(1).max(10),
        description: yup.string()
    })
}


module.exports = { validateRole }
