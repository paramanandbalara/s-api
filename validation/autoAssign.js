const Yup = require('yup');

const validateAddOrEditHubReq = Yup.object({
  body: Yup.object({
    autoAssignName: Yup.string()
      .required()
      .oneOf(['auto_route_assignment', 'zone_wise_route_assignment']),
    hubsList: Yup.array().of(Yup.number()).required(),
  }),
});

const updateStatus = Yup.object({
  body: Yup.object({
    status: Yup.number()
      .integer('Status must be an integer')
      .oneOf([0, 1], 'Status must be either 0 or 1')
      .required(),
    autoAssignName: Yup.string()
      .required()
      .oneOf(['auto_route_assignment', 'zone_wise_route_assignment']),
  }),
});

const riderStartLocation = Yup.object({
  body: Yup.object({
    riderStartLocation: Yup.string()
      .required()
      .oneOf(['hub', 'home', 'current']),
  }),
  params: Yup.object({
    settingName: Yup.string().default('riderStartLocation'),
  }),
});

const autoAssignMethod = Yup.object({
  body: Yup.object({
    autoAssignMethod: Yup.string()
      .required()
      .oneOf(['closest_rider', 'shortest_route']),
  }),
  params: Yup.object({
    settingName: Yup.string().default('autoAssignMode'),
  }),
});

const considerRiderCapicity = Yup.object({
  body: Yup.object({
    considerRiderCapicity: Yup.number().integer().oneOf([0, 1]).required(),
  }),
  params: Yup.object({
    settingName: Yup.string().default('considerRiderCapicity'),
  }),
});

const serviceType = Yup.object({
  body: Yup.object({
    serviceType: Yup.string()
      .required()
      .oneOf(['pickup', 'delivery', 'pickup_delivery']),
  }),
  params: Yup.object({
    settingName: Yup.string().default('serviceType'),
  }),
});


const singlePackageWeightLimit = Yup.object({
  body: Yup.object({
    bikeWeightLimit: Yup.number()
      .typeError('Invalid value. Only numbers allowed, without any decimal.')
      .positive('Invalid value. Only numbers allowed, without any decimal.')
      .integer('Invalid value. Only numbers allowed, without any decimal.'),
    echoWeightLimit: Yup.number()
      .typeError('Invalid value. Only numbers allowed, without any decimal.')
      .positive('Invalid value. Only numbers allowed, without any decimal.')
      .integer('Invalid value. Only numbers allowed, without any decimal.'),
    tataAceWeightLimit: Yup.number()
      .typeError('Invalid value. Only numbers allowed, without any decimal.')
      .positive('Invalid value. Only numbers allowed, without any decimal.')
      .integer('Invalid value. Only numbers allowed, without any decimal.'),
  }),
  params: Yup.object({
    settingName: Yup.string().default('singlePackageWeightLimit'),
  }),
});



const maxRequestPerRider = Yup.object({
  body: Yup.object({
    bikeRequestLimit: Yup.number()
      .typeError('Invalid value. Only numbers allowed, without any decimal.')
      .positive('Invalid value. Only numbers allowed, without any decimal.')
      .integer('Invalid value. Only numbers allowed, without any decimal.'),
    echoRequestLimit: Yup.number()
      .typeError('Invalid value. Only numbers allowed, without any decimal.')
      .positive('Invalid value. Only numbers allowed, without any decimal.')
      .integer('Invalid value. Only numbers allowed, without any decimal.'),
    tataAceRequestLimit: Yup.number()
      .typeError('Invalid value. Only numbers allowed, without any decimal.')
      .positive('Invalid value. Only numbers allowed, without any decimal.')
      .integer('Invalid value. Only numbers allowed, without any decimal.'),
  }),
  params: Yup.object({
    settingName: Yup.string().default('maxRequestPerRider'),
  }),
});

const autoAssignmentRouteMethod = Yup.object({
  body: Yup.object({
    routeMethod: Yup.string()
      .required()
      .oneOf(['customJSMethod', 'googleMap', 'nextbillionAIMaps']),
  }),
  params: Yup.object({
    settingName: Yup.string().default('autoAssignmentRouteMethod'),
  }),
});


module.exports = {
  validateAddOrEditHubReq,
  updateStatus,
  riderStartLocation,
  autoAssignMethod,
  considerRiderCapicity,
  serviceType,
  singlePackageWeightLimit,
  maxRequestPerRider,
  autoAssignmentRouteMethod,
};
