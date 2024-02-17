'use strict';

const Yup = require('yup');

const validateAppSettingReq = Yup.object({
	body: Yup.object({
	  userList: Yup.array().of(Yup.number()).default([]),
	  hubsList: Yup.array().of(Yup.number()).default([]),
		settingName: Yup.string().required(),
	  distance: Yup.number().positive(),
	}),
  });

const validavalidateAppSettingBySettingId = Yup.object().shape({
	query: Yup.object().shape({
		settingName: Yup.string().required(),
	}),
});

//TODO  need refactor using shape api
const validateDistanceRestrictionReq = Yup.object({
  body: Yup.object({
    userList: Yup.array().of(Yup.number()).default([]),
    hubsList: Yup.array().of(Yup.number()).default([]),
    status: Yup.number()
      .integer('Status must be an integer')
      .oneOf([0, 1], 'Status must be either 0 or 1'),
	  settingName: Yup.string().required(),
    distance: Yup.number().integer().positive().required(),
  }),
});

module.exports = { validateAppSettingReq, validavalidateAppSettingBySettingId, validateDistanceRestrictionReq };
