'use strict';

const Yup = require('yup');
const dayjs = require('dayjs');

const getNotificationReportValidation = Yup.object({
  query: Yup.object({
    notificationName: Yup.string().required('Please select notification name'),
    startDate: Yup.string()
      .required('Start date is required')
      .transform((value, originalValue) => {
        return dayjs(originalValue).format('YYYY-MM-DD 00:00:00');
      }),
    endDate: Yup.string()
      .required('End date is required')
      .transform((value, originalValue) => {
        return dayjs(originalValue).format('YYYY-MM-DD 23:59:59');
      })
  })
});

module.exports = { getNotificationReportValidation };
