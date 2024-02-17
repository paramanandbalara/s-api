const axios = require('axios');
const jwt = require("jsonwebtoken");

const { URL, SECRET_KEY } = require("../../shyptrack-static/notification.json");


const sendWhatsAppNotification = async (number, templateName, data) => {
    try {
        const token = jwt.sign({ 'service': 'sx-notifaction', 'used_by': 'shyptrack', 'timestamp': +new Date() }, SECRET_KEY)
        const components = [
            {
                "type": "body",
                "parameters": data
            }
        ]
        
        const whatsAppOptions = {
            "channel": "whatsapp",
            "messaging_product": "whatsapp",
            "to": '91' + number,
            "type": "template",
            "template": {
                "name": templateName,
                "language": {
                    "code": "en_US"
                },
                "components": components
            }
        }

        const config = {
            method: 'POST',
            url: `${URL}/send-notification`,
            data: whatsAppOptions,
            headers: {
                "Content-type": "application/json",
                'Authorization': `${token}`
            }
        };

        await axios(config);

        return "Notification sent on whatsApp";

    } catch (exception) {
        console.error(exception);
        throw new Error(exception.message || exception)
    }
}

module.exports = { sendWhatsAppNotification }