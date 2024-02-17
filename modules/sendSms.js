const axios = require('axios');
const jwt = require("jsonwebtoken");

const { URL, SECRET_KEY } = require("../../shyptrack-static/notification.json");


const sendSms = async(contentVars, contact_number, templateName) => {
    try {
        let token = jwt.sign({ 'service': 'sx-notifaction', 'used_by': 'shyptrack', 'timestamp': +new Date() }, SECRET_KEY)

        let smsOptions = {
            channel: "sms",
            templateName,
            templateType: "txt",
            data: {
                to: [contact_number],
                contentVars: contentVars
            }
        };

        let config = {
            method: 'POST',
            url: `${URL}/send-notification`,
            data: smsOptions,
            headers: {
                "Content-type": "application/json",
                'Authorization': `${token}`
            }
        };

        await axios(config);

        return "Sms sent";

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

module.exports = { sendSms }