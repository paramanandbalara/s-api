'use strict';

const { Router } = require('express');
const router = Router();
const RoleController = require('../controller/roles');

router.get('/roles', async (req, res, next) => {
  try {
    const roleController = new RoleController();

    const result = await roleController.getAllRoles();

    res.send({ success: true, message: `Roles data Retrieved`, data: result });
  } catch (exception) {
    console.error(exception.message || exception);

    res.send({ success: false, message: exception.message });
  }
});

router.post('/roles/create', async (req, res, next) => {
  try {
    const roleController = new RoleController();
    const userId = Number(req.header('x-userid'));

    const result = await roleController.createRole(userId, req.body);

    res.send({ success: true, message: `Roles created successfully` });
  } catch (exception) {
    console.error(exception.message || exception);

    res.send({ success: false, message: exception.message });
  }
});

router.get('/roles/route/:role_id', async (req, res, next) => {
  try {
    const { role_id } = req.params;

    const roleController = new RoleController();
    const result = await roleController.getRolesDataById(role_id);

    res.send({ success: true, message: `Roles data Retrieved`, data: result });
  } catch (exception) {
    console.error(exception);

    res.send({ success: false, message: exception.message });
  }
});

router.post('/roles/edit/:id', async (req, res, next) => {
  try {
    const userId = Number(req.header('x-userid'));
    const { id: roleId } = req.params;
    const roleController = new RoleController();
    await roleController.editUserRoles(userId, roleId, req.body);
    res.send({ success: true, message: `Role updated successfully` });
  } catch (exception) {
    console.error(exception.message || exception);

    res.send({ success: false, message: exception.message });
  }
});

module.exports = router;
