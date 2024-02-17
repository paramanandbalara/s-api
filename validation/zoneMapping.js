'use strict';

const Yup = require('yup');

const createZone = Yup.object({
    body: Yup.object({
      hubId: Yup.number().integer('Hub Id must be an integer').required(),
      zoneName: Yup.string().required('Zone name is not found').trim(),
      pincodes: Yup.string()
        .required('Zone pincode is required')
    }),
  });

  const updateZone = Yup.object({
    body: Yup.object({
      zoneId : Yup.number().integer('Zone Id must be an integer').required(),
      hubId: Yup.number().integer('Hub Id must be an integer').required(),
      zoneName: Yup.string().required('Zone name is not found').trim(),
      pincodes: Yup.string()
        .required('Zone pincode is required')
    }),
  });
  

const updateZoneStatus = Yup.object({
	body: Yup.object({
		zoneId: Yup.number().integer('Id must be an integer').required("Zone id not found"),
		status: Yup.number()
		.integer('Status must be an integer')
		.oneOf([0, 1], 'Status must be either 0 or 1').required("Status not found"),
		
	}),
});


const zoneList = Yup.object({
	query: Yup.object({
		hubId: Yup.string().required("Hub id not found")
	}),
});


module.exports = { createZone, updateZoneStatus, updateZone, zoneList };
