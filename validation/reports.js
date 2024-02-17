'use strict';

const Yup = require('yup');

const addOrRemoveFavouriteSchema = Yup.object().shape({
    body: Yup.object().shape({
        reportId: Yup.number().required(),
        value: Yup.number().min(0).max(1).required()
    })
});

const inventoryExport = Yup.object({
    query: Yup.object({
        hub_id: Yup.number()
            .typeError("Hub Id must be a number")
            .required('Hub Id not found')
            .integer('Hub Id must be an integer')
            .positive('Hub Id must be a positive number'),
        startDate: Yup.date()
            .required('Start date is required'),
        endDate: Yup.date()
            .required('End date is required')
            .test('is-valid-range', 'Date range must be within 30 days', function (endDate) {
                const { startDate } = this.parent;
                const diffInDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                return diffInDays <= 30;
            })
    })
});





module.exports = { addOrRemoveFavouriteSchema, inventoryExport };

