"use strict";

const axios = require('axios');
const jwt = require("jsonwebtoken");
const notificationService = require("../../shyptrack-static/notification.json");


const sendEmail = async (email, name, templateName, contentVars, subject) => {
    const token = jwt.sign({ 'service': 'sx-notifaction', 'used_by': 'shyptrack', 'timestamp': +new Date() }, notificationService.SECRET_KEY);

    let toEmailArr = [];
    
    if (Array.isArray(email)) {
        for (const iterator of email) {
            let obj = {}
            obj['email'] = iterator.trim();
            obj['name'] = ''
            toEmailArr.push(obj);
        }
    } else {
        let obj = {
            email : email.trim(),
            name
        }
        toEmailArr.push(obj)
    }
    
    let mailOptions = {
        channel: "email",
        templateName: templateName,
        templateType: "html",
        data: {
            sender: {
                name: "",
                email: ""
            },
            to: toEmailArr,
            contentVars: contentVars,
            subject: subject
        }
    };

    let config = {
        method: 'POST',
        url: `${notificationService.URL}/send-notification`,
        data: mailOptions,
        headers: {
            "Content-type": "application/json",
            'Authorization': `${token}`
        }
    };

    try {
        await axios(config);
        return "Sucessfully sent mail"
    }
    catch (exception) {
        console.log(exception);
        return "Failed to send mail";
    }

}

module.exports = {
    sendEmail
}