'use strict';

const {
  getAllRoles,
  getRoleByName,
  createNewRole,
  getRouteGroupByRouteId,
} = require('../models/roles');
const ManageRoutesController = require('./manageRoutes');
const routesController = new ManageRoutesController();
const userModel = require('../models/users');
const authModel = require('../models/authToken');
const {
  setting: { app_setting_access_user: appSettingAccessUser = [] } = {},
} = require('../../shyptrack-static/stconfig.json');
class Roles {
  async getAllRoles() {
    try {
      const result = await getAllRoles();
      return result;
    } catch (exception) {
      throw new Error(exception.message);
    }
  }

  async getRoles() {
    try {
      const result = await getAllRoles();
      return result;
    } catch (exception) {
      throw new Error(exception.message || exception);
    }
  }

  async createRole(userId, body) {
    try {
      if (!body.role) {
        throw new Error('Role name not defined');
      }
      const role = await getRoleByName(body.role);
      if (role?.length) {
        throw new Error('Role already exists');
      }

      const { selected_routes: selectedRoutes = [] } = body;

      if (!selectedRoutes?.length) {
        throw new Error('No Route found');
      }

      await this.saveRole(selectedRoutes, body, userId);
    } catch (exception) {
      throw new Error(exception.message || exception);
    }
  }

  async getUniqueAfterMerge(arr1, arr2) {
    let arr = arr1.concat(arr2);
    let uniqueArr = [];

    for (let i of arr) {
      if (uniqueArr.indexOf(i) === -1) {
        uniqueArr.push(i);
      }
    }

    return uniqueArr;
  }

  async saveRole(selectedRoutes, obj, userId) {
    try {
      await this.validateUserCanAddOrEditParticualrRouteGroup(
        userId,
        selectedRoutes,
      );
        
      const saveRole = await this.saveNewAddedRoles(obj);

      const roleId = saveRole.insertId;

      const routeIdData = Array.isArray(selectedRoutes)
        ? selectedRoutes
        : [selectedRoutes];

      const data = routeIdData.map((routeId) => [routeId, roleId, 1]);

      await routesController.saveOrEditRoutes(data);
    } catch (exception) {
      throw new Error(exception.message || exception);
    }
  }

  async saveNewAddedRoles(data) {
    try {
      const { role, description } = data;

      const result = await createNewRole({ role, description });
      return result;
    } catch (exception) {
      throw new Error(exception.message || exception);
    }
  }

  async getRolesDataById(role_id = null) {
    try {
      let locals = Object.assign({});

      locals = await this.updated_routes_group();
      const role_data = await routesController.getParticularRoleDetail(role_id);

      locals.role_data = role_data;

      const auth_routes = await routesController.getParticularRoutesAuth(
        role_id,
      ); //routes assigned to roleId selected

      let routes_obj = {};
      const routes_arr = await this.arrayToObject(locals.routes, 'id');
      const auth_routes_arr = await this.arrayToObject(auth_routes, 'route_id');

      for (const key in routes_arr) {
        routes_obj[key] = {
          ...routes_arr[key][0],
          selected: auth_routes_arr[key] ? true : false,
        };
      }

      locals.routes = Object.values(routes_obj);

      return locals;
    } catch (exception) {
      throw new Error(exception.message || exception);
    }
  }

  async getRoutesGroupMap(routes) {
    try {
      return routes.reduce((index, { id, route, routes_group_id }) => {
        const existing = index.find(
          (i) => i.routes_group_id === routes_group_id,
        );

        if (existing) {
          existing.id.push(id);

          existing.route.push(route);
        } else {
          index.push({ id, routes_group_id, id: [id], route: [route] });
        }

        return index;
      }, []);
    } catch (exception) {
      throw new Error(exception.message || exception);
    }
  }

  async updated_routes_group() {
    try {
      let locals = Object.assign({});
      let routes_data = await routesController.getRoutes();
      let routes_group_arr = [];

      for (const iterator of routes_data) {
        if (iterator.route.split('/')[1]?.length > 1)
          routes_group_arr.push(iterator.route.split('/')[1]);
      }

      let unique_routes_group = [...new Set(routes_group_arr)];

      let routes_group = await routesController.getRoutesGroup();
      let arr = [];

      for (const iterator of routes_group) {
        arr.push(iterator.routes_group);
      }

      let difference = unique_routes_group.filter((x) => !arr.includes(x));

      if (difference?.length > 0) {
        for (const iterator of difference) {
          await routesController.setNewRoutesGroup(iterator);
        }
      }

      let updated_routes_data = await routesController.getRoutes();
      let updated_routes_group = await routesController.getRoutesGroup();

      for (const iterator of updated_routes_data) {
        if (iterator.routes_group_id == 0)
          for (const iterator2 of updated_routes_group) {
            if (iterator.route.split('/')[1] == iterator2.routes_group) {
              await routesController.updateRoutesGroupId(
                iterator2.id,
                iterator.id,
              );
            }
          }
      }

      let routes = await routesController.getRoutes();
      let route_groups = await routesController.getRoutesGroup();

      Object.assign(locals, { routes, route_groups });

      return locals;
    } catch (exception) {
      throw new Error(exception.message);
    }
  }

  async getGroupWiseRoutes(routes, route_groups) {
    let finalDataObj = {};
    let route_groups_obj = await this.arrayToObject(route_groups, 'id');
    let routes_obj = await this.arrayToObject(routes, 'routes_group_id');

    for (const key in route_groups_obj) {
      finalDataObj[key] = {
        ...route_groups_obj[key][0],
        routes: routes_obj[key],
      };
    }

    finalDataObj = Object.values(finalDataObj);

    return finalDataObj;
  }

  async arrayToObject(arr, key) {
    const obj = {};
    for (let item of arr) {
      if (obj[item[key]] === undefined) {
        obj[item[key]] = [];
      }
      obj[item[key]].push(item);
    }
    return obj;
  }

  async editUserRoles(userId, roleId, body) {
    try {
      const {
        selected_routes: selectedRoutes = [],
        rejected_routes: rejectedRoutes = [],
      } = body;

      if (!selectedRoutes.length) {
        throw new Error('No routes found');
      }

      const routeIdData = Array.isArray(selectedRoutes)
        ? selectedRoutes
        : [selectedRoutes];

      const data = routeIdData.map((routeId) => [routeId, roleId, 1]); // [route_id, roleId, status = 1]
      await this.validateUserCanAddOrEditParticualrRouteGroup(
        userId,
        selectedRoutes,
      );

      await routesController.saveOrEditRoutes(data);

      if (rejectedRoutes.length) {
        await routesController.inactiveRolesRoutes(roleId, rejectedRoutes);
      }

      const usersByRoleId = await userModel.getUsersByRoleId(roleId);

      if (usersByRoleId.length) {
        const userIds = usersByRoleId.map((user) => user.id);

        try {
          await authModel.updateTokenStatus(userIds, 2); // Set session status to inactive
        } catch (exception) {
          console.error(exception);
          throw new Error('User updated. Please logout and login again');
        }
      }
    } catch (exception) {
      throw exception;
    }
  }

  async validateUserCanAddOrEditParticualrRouteGroup(userId, selectedRoutes) {
    try {
      const routesGroup = await getRouteGroupByRouteId(selectedRoutes);
      const routeGroupNames = routesGroup.map(
        ({ routes_group }) => routes_group,
      );

      if (
        !appSettingAccessUser.includes(Number(userId)) &&
        routeGroupNames.includes('app-setting')
      ) {
        throw new Error(
          'You are not authorised to assign/remove App Settings. Please contact support',
        );
      }
    } catch (exception) {
      throw exception;
    }
  }
}

module.exports = Roles;
