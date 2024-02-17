"use strict";

const getAllRoles = async () => {
    try {
        const query = `SELECT * FROM roles;`
        const [rows] = await readDB.query(query);
        return rows;
    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getRoleByName = async (role) => {
    try {
        const query = `SELECT * FROM roles WHERE role = ?;`
        const [rows] = await readDB.query(query, [role]);
        return rows;
    } catch (exception) {
        throw new Error(exception.message)
    }
}

const createNewRole = async (data) => {
    try {
        const [rows] = await writeDB.query(`INSERT INTO roles SET ?`, [data]);
        return rows;
    } catch (exception) {
        throw new Error(exception.message)
    }
}

const getRouteGroupByRouteId = async (routeIds) => {
    try {
       const query = `
                  SELECT
                    rg.routes_group
                  FROM
                    routes r
                  INNER JOIN
                    routes_group rg ON rg.id = r.routes_group_id
                  WHERE
                    r.id IN (?)
                  GROUP BY
                    rg.id;`;

        const [rows] = await readDB.query(query, [routeIds]);
        return rows;
    } catch (exception) {
      throw new Error(exception.message);
    }
}



module.exports = {
  getAllRoles,
  getRoleByName,
  createNewRole,
  getRouteGroupByRouteId,
};