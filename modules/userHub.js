const USER_MODEL = require('../models/users')

const getHubIdByUser = async (user_id) => {

    try {
        const hub_ids = await USER_MODEL.getHubsByUserId(user_id);

        if (hub_ids.length >1) {
            throw new Error(` Unauthorized, Multiple hubs are assigned you.
                            If you need to perform hubops task, please ensure only 1 hub is assigned to you`)
        }
        if (hub_ids.length < 1) {
            throw new Error(` Unauthorized, No hubs are assigned you.
                            If you need to perform hubops task, please ensure atleast 1 hub is assigned to you`)
        }
       
        return hub_ids[0];

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }

}

const getAllHubsByUser = async (user_id, is_gateway = false) => {
    try {
        const hub_ids = await USER_MODEL.getHubsByUserId(user_id, is_gateway);

        return hub_ids;

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

module.exports = { getHubIdByUser, getAllHubsByUser }