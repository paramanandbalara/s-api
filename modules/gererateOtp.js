'use strict'

const generateOtp = async () => {
   const minRange = 100000;
   const maxRange = 999999;
   const otp = Math.floor(Math.random() * (maxRange - minRange + 1)) + minRange;
   return otp;
}

module.exports = { generateOtp }