
"use strict";

const getAuthorizedURLs = async (role) => {
    try {
        if (!role)
            throw new Error([]);
        const [rows] = await readDB.query(`SELECT route FROM routes WHERE id in (SELECT route_id FROM role_authorization WHERE role_id = ${role})`)

        if (rows && rows.length)
            return (rows.map((row) => { return row.route }));
    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message)
    }
}

const getSavedRoutes = async () => {
    try {
        const [rows] = await readDB.query(`SELECT route FROM routes`);
        if (rows && rows.length)
            return rows;
        return [];
    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message)
    }
}

const setNewRoutes = async (newRoutes) => {
    try {
        if (newRoutes.length)
            await writeDB.query(`INSERT INTO routes(route) VALUES ${newRoutes}`)
        return true;
    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message)
    }
}

const getRoutes = async (role_group_id = null) => {
    try {
        let condition = ``;
        if (role_group_id) {
            condition = `WHERE routes_group_id IN (?)`
        }
        const query = `SELECT * from routes ${condition};`
        let [rows, fields] = await readDB.query(query, [role_group_id]);

        return rows;

    } catch (exception) {
        console.error(exception)
        throw new Error(exception.message)
    }
}

const getRoutesGroup = async () => {
    try {
        const query = `SELECT * FROM routes_group`
        let [rows] = await readDB.query(query);

        return rows;

    } catch (exception) {

        console.error(exception)

        throw new Error(exception.message)
    }
}

const setNewRoutesGroup = async (new_routes_group) => {
    try {
        if (new_routes_group.length)
            await writeDB.query(`INSERT INTO routes_group(routes_group) VALUES (?)`, [new_routes_group])

        return true;

    } catch (exception) {

        console.error(exception)

        throw new Error(exception.message)
    }
}

const updateRoutesGroupId = async (routes_group_id, route_id) => {
    try {
        const query = `UPDATE routes SET routes_group_id = ? WHERE id = ?;`;

        let [rows] = await writeDB.query(query, [routes_group_id, route_id]);


        return rows;

    } catch (exception) {

        console.error(exception)

        throw new Error(exception.message)
    }

}


const saveOrEditRoutes = async (data) => {
    try {
        const query = `INSERT INTO role_authorization (route_id, role_id, status) VALUES ?
                        ON DUPLICATE KEY UPDATE route_id = route_id, status = 1;`;

        let [rows] = await writeDB.query(query, [data]);

        return rows;

    } catch (exception) {

        console.error(exception)

        throw new Error(exception.message)
    }

}

const inactiveRolesRoutes = async (role_id, routes_ids) => {
    try {
        const query = `UPDATE role_authorization SET  status = 0 WHERE role_id = ? AND route_id IN (?)`;
        let [rows] = await writeDB.query(query, [role_id, routes_ids]);

        return rows;

    } catch (exception) {

        console.error(exception)

        throw new Error(exception.message)
    }

} 

const getParticularRoleDetail = async (id) => {
    try {
        const [rows] = await readDB.query(`SELECT * FROM roles WHERE id = ?`, [id]);

        return rows;

    } catch (exception) {

        console.error(exception)

        throw new Error(exception.message)
    }
}

const getParticularRoutesAuth = async (role_id) => {
    try {
        const [rows] = await readDB.query(`SELECT routes.route, routes.routes_group_id, ra.route_id FROM role_authorization as ra INNER JOIN routes  ON routes.id = ra.route_id WHERE ra.status =1 AND ra.role_id = ?;`, [role_id]);

        return rows;

    } catch (exception) {

        console.error(exception)

        throw new Error(exception.message)
    }
}


module.exports = { getAuthorizedURLs, getSavedRoutes, setNewRoutes, getRoutes, getRoutesGroup, setNewRoutesGroup, updateRoutesGroupId, saveOrEditRoutes, getParticularRoleDetail, getParticularRoutesAuth, inactiveRolesRoutes };