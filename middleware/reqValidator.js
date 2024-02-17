'use strict';

function validateRequest(schema, stripUnknown = false, sync = true) {
  return async function (req, res, next) {
    try {
      const validatedData = sync
        ? schema.validateSync({
            body: req.body,
            query: req.query,
            params: req.params,
          }, {stripUnknown})
        : await schema.validate({
            body: req.body,
            query: req.query,
            params: req.params,
          }, {stripUnknown});
      ['body', 'query', 'params'].forEach((key) => {
        req[key] = validatedData[key];
      });
      return next();
    } catch (err) {
      return res.json({ success: false, type: err.name, message: err.message });
    }
  };
}

module.exports = validateRequest;
