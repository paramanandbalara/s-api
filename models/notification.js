"use strict"

const riderUnusualKm = async (userId, intervalDay) => {
    try {
        const query = `SELECT U.name AS riderName, RCC.checkout_odometer_reading - RCC.checkin_odometer_reading AS kmDiff, 
                        RCC.user_id AS rider_id, CURDATE() - INTERVAL ? DAY AS on_date, HD.code AS hub_code
                        FROM rider_checkin_checkout RCC
                        INNER JOIN users U ON U.id = RCC.user_id
                        INNER JOIN user_hub UH ON U.id = UH.user_id
                        INNER JOIN hub_details HD ON HD.id = UH.hub_id
                        WHERE UH.hub_id IN (SELECT hub_id FROM user_hub WHERE user_id = ?)
                          AND (RCC.checkout_odometer_reading - RCC.checkin_odometer_reading) > 300
                          AND RCC.checkin_date BETWEEN CONVERT_TZ(DATE_FORMAT(CURDATE() - INTERVAL ? DAY, '%Y-%m-%d 00:00:00'), '+05:30', '+00:00') 
                          AND CONVERT_TZ(DATE_FORMAT(CURDATE() - INTERVAL ? DAY, '%Y-%m-%d 23:59:59'), '+05:30', '+00:00');`
        const [rows] = await readDB.query(query, [intervalDay, userId, intervalDay, intervalDay])
        return rows;
    } catch (error) {
        throw error;
    }
}
const riderLessPickup = async (userId, intervalDay) => {
    try {
        const query = `SELECT U.name AS riderName, RRA.rider_id, COUNT(RRA.id) AS totalAssignedPickupRequest, 
                        CURDATE() - INTERVAL ? DAY AS on_date,  HD.code AS hub_code
                        FROM route_request_assigned RRA
                        INNER JOIN users U ON U.id = RRA.rider_id
                        INNER JOIN user_hub UH ON U.id = UH.user_id
                        INNER JOIN hub_details HD ON HD.id = UH.hub_id
                        WHERE UH.hub_id IN (SELECT hub_id FROM user_hub WHERE user_id = ?)
                          AND RRA.created BETWEEN CONVERT_TZ(DATE_FORMAT(CURDATE() - INTERVAL ? DAY, '%Y-%m-%d 00:00:00'), '+05:30', '+00:00') 
                          AND CONVERT_TZ(DATE_FORMAT(CURDATE() - INTERVAL ? DAY, '%Y-%m-%d 23:59:59'), '+05:30', '+00:00')
                        GROUP BY 
                            RRA.rider_id
                        HAVING 
                            totalAssignedPickupRequest < 3;`
        const [rows] = await readDB.query(query, [intervalDay, userId, intervalDay, intervalDay])
        return rows;
    } catch (error) {
        throw error;
    }
}


const mismatchInInscanBaggingOutscan = async (userId, intervalDay) => {
    try {
        const query = `SELECT COUNT(OE.id) AS event_count, HD.code AS hub_code, HD.id AS hub_id, OE.status, CURDATE() - INTERVAL ? DAY AS on_date
                FROM order_event OE
                INNER JOIN orders O ON OE.order_id = O.id
                INNER JOIN hub_details HD ON HD.id = O.hub_id
                INNER JOIN user_hub UH ON HD.id = UH.hub_id
                WHERE OE.status IN (5, 6, 7)
                  AND UH.hub_id IN (SELECT hub_id FROM user_hub WHERE user_id = ?)
                  AND OE.event_created_at BETWEEN CONVERT_TZ(DATE_FORMAT(CURDATE() - INTERVAL ? DAY, '%Y-%m-%d 00:00:00'), '+05:30', '+00:00') 
                  AND CONVERT_TZ(DATE_FORMAT(CURDATE() - INTERVAL ? DAY, '%Y-%m-%d 23:59:59'), '+05:30', '+00:00')
                GROUP BY 
                    OE.status, HD.id;`
        const [rows] = await readDB.query(query, [intervalDay, userId, intervalDay, intervalDay])
        return rows;
    } catch (error) {
        throw error;
    }
}

const airwayBillNotUploaded = async (userId, intervalDay) => {
    try {
        const query = `SELECT
                          HD.code AS hub_code,
                          CURDATE() - INTERVAL ? DAY AS on_date
                        FROM
                          bag_details BD
                          INNER JOIN hub_details HD ON BD.hub_id = HD.id
                          INNER JOIN user_hub UH ON HD.id = UH.hub_id
                        WHERE
                          UH.hub_id IN (SELECT hub_id FROM user_hub WHERE user_id = ?)
                          AND BD.outscan_date BETWEEN
                            CONVERT_TZ(DATE_FORMAT(CURDATE() - INTERVAL ? DAY, '%Y-%m-%d 00:00:00'), '+05:30', '+00:00')
                            AND CONVERT_TZ(DATE_FORMAT(CURDATE() - INTERVAL ? DAY, '%Y-%m-%d 23:59:59'), '+05:30', '+00:00')
                          AND BD.transporter_awbno LIKE 'temp-airway-%' 
                        GROUP BY
                          BD.hub_id;`
        const [rows] = await readDB.query(query, [intervalDay, userId, intervalDay, intervalDay])
        return rows;
    } catch (error) {
        throw error;
    }
}

const lowBagSeal = async (userId) => {
    try {
        const query = `SELECT
                          HD.code AS hub_code,
                          HD.id AS hub_id,
                          HD.available_bag_count,
                          HD.available_seal_count
                        FROM
                          hub_details HD
                          INNER JOIN user_hub UH ON HD.id = UH.hub_id
                        WHERE
                          UH.hub_id IN (SELECT hub_id FROM user_hub WHERE user_id = ?)
                          AND (HD.available_bag_count <= 20 OR HD.available_seal_count <= 20)
                          AND HD.type IN (0, 3)
                          GROUP BY HD.id ;`
        const [rows] = await readDB.query(query, [userId])
        return rows;
    } catch (error) {
        throw error;
    }
}

const riderUnusualKmReport = async ({userId, startDate, endDate}) => {
  try {
    const query = `SELECT U.name AS riderName, RCC.checkout_odometer_reading - RCC.checkin_odometer_reading AS kmDiff, 
                        RCC.user_id AS rider_id, HD.code AS hub_code, RCC.checkin_date
                        FROM rider_checkin_checkout RCC
                        INNER JOIN users U ON U.id = RCC.user_id
                        INNER JOIN user_hub UH ON U.id = UH.user_id
                        INNER JOIN hub_details HD ON HD.id = UH.hub_id
                        WHERE UH.hub_id IN (SELECT hub_id FROM user_hub WHERE user_id = ?)
                          AND (RCC.checkout_odometer_reading - RCC.checkin_odometer_reading) > 300
                          AND RCC.checkin_date BETWEEN ?
                          AND ?;`;
    const [rows] = await readDB.query(query, [userId, startDate, endDate]);
    return rows;
  } catch (error) {
    throw error;
  }
};

const riderLessPickupReport = async ({ userId, startDate, endDate }) => {
  try {
      const query = `SELECT
                        U.name AS riderName,
                        RRA.rider_id,
                        COUNT(RRA.id) AS totalAssignedPickupRequest,
                        HD.code AS hub_code,
                        DATE_FORMAT(RRA.created, '%Y-%m-%d') AS createdDate
                    FROM
                        route_request_assigned RRA
                    INNER JOIN
                        users U ON U.id = RRA.rider_id
                    INNER JOIN
                        user_hub UH ON U.id = UH.user_id
                    INNER JOIN
                        hub_details HD ON HD.id = UH.hub_id
                    WHERE
                        UH.hub_id IN (SELECT hub_id FROM user_hub WHERE user_id = ?)
                        AND RRA.created BETWEEN ? AND ?
                    GROUP BY
                        RRA.rider_id,
                        createdDate
                    HAVING
                        totalAssignedPickupRequest < 3;`;
    
    const [rows] = await readDB.query(query, [userId, startDate, endDate]);
    return rows;
  } catch (error) {
    throw error;
  }
};

const mismatchInInscanBaggingOutscanReport = async ({
  userId,
  startDate,
  endDate
}) => {
  try {
    const query = `SELECT COUNT(OE.id) AS event_count, HD.code AS hub_code, HD.id AS hub_id, OE.status
                FROM order_event OE
                INNER JOIN orders O ON OE.order_id = O.id
                INNER JOIN hub_details HD ON HD.id = O.hub_id
                INNER JOIN user_hub UH ON HD.id = UH.hub_id
                WHERE OE.status IN (5, 6, 7)
                  AND UH.hub_id IN (SELECT hub_id FROM user_hub WHERE user_id = ?)
                  AND ?
                  AND ?
                GROUP BY 
                    OE.status, HD.id;`;
    const [rows] = await readDB.query(query, [userId, startDate, endDate]);
    return rows;
  } catch (error) {
    throw error;
  }
};

const airwayBillNotUploadedReport = async ({ userId, startDate, endDate }) => {
  try {
    const query = `SELECT
                          HD.code AS hub_code
                        FROM
                          bag_details BD
                          INNER JOIN hub_details HD ON BD.hub_id = HD.id
                          INNER JOIN user_hub UH ON HD.id = UH.hub_id
                        WHERE
                          UH.hub_id IN (SELECT hub_id FROM user_hub WHERE user_id = ?)
                          AND BD.outscan_date BETWEEN
                           ?
                            AND ?
                          AND BD.transporter_awbno LIKE 'temp-airway-%' 
                        GROUP BY
                          BD.hub_id;`;
    const [rows] = await readDB.query(query, [userId, startDate, endDate]);
    return rows;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  riderUnusualKm,
  riderLessPickup,
  mismatchInInscanBaggingOutscan,
  airwayBillNotUploaded,
  lowBagSeal,
  riderUnusualKmReport,
  riderLessPickupReport,
  mismatchInInscanBaggingOutscanReport,
  airwayBillNotUploadedReport
};