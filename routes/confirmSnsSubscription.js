'use strict';

const express = require('express');
const AWS = require('aws-sdk');

const {isAppAuthorized} = require('../modules/authorization/appAuth');

AWS.config.update({ region: process.env.snsregion });

const router = new express.Router();

router.post('/confirm-sns-subscription', isAppAuthorized, confirmSnsSubscriptionHandler);


async function confirmSnsSubscriptionHandler(req, res) {
  const {token, topicArn} = req.body;
  if(!token || !topicArn) {
    const message = `Invalid value of token - ${token} or topicArn - ${topicArn}`;
    res.status(400);
    res.json({message});
    return;
  }
  
  const SNS = new AWS.SNS({
    apiVersion: process.env.snsapiVersion,
    credentials: new AWS.SharedIniFileCredentials({ profile: 'sx-sqs' })
  });
  
  try {
    const confirmSubResp = await SNS.confirmSubscription({
      Token: token,
      TopicArn: topicArn,
    }).promise();
    
    res.status(200);
    res.json({subscriptionArn: confirmSubResp.SubscriptionArn})
  } catch(err) {
    const msg = `Error in subscription confirmation - ${err}`
    console.error(msg)
    res.status(500);
    res.json({message: msg});
  }
}

module.exports = router;
