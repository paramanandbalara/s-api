"use strict";
const getSlotwisePickupCount = async (intervalDay) => {
    try {
        const query = `SELECT
                            date,
                            slot_time,
                            CONCAT(
                                CASE
                                    WHEN slot_time % 2 = 0 THEN CONCAT(slot_time, ':00-', slot_time + 2, ':00')
                                    ELSE CONCAT(slot_time - 1, ':00-', slot_time + 1, ':00')
                                END
                            ) AS slot_hour,
                            order_count
                        FROM (
                            SELECT
                                DATE(CONVERT_TZ(event_created_at, 'UTC', 'Asia/Kolkata')) AS date,
                                HOUR(CONVERT_TZ(event_created_at, 'UTC', 'Asia/Kolkata')) AS slot_time,
                                COUNT(id) AS order_count
                            FROM
                                order_event
                            WHERE
                                status = 4
                                AND remarks = 'Picked-up'
                                AND event_created_at BETWEEN CONVERT_TZ(CONCAT(DATE_FORMAT(CURDATE() - INTERVAL ? DAY, '%Y-%m-%d'), ' 00:00:00'), '+05:30', '+00:00') 
                                                          AND CONVERT_TZ(CONCAT(DATE_FORMAT(CURDATE() - INTERVAL ? DAY, '%Y-%m-%d'), ' 23:59:59'), '+05:30', '+00:00')
                                AND HOUR(CONVERT_TZ(event_created_at, 'UTC', 'Asia/Kolkata')) BETWEEN 10 AND 22
                            GROUP BY
                                date,
                                slot_time DIV 2
                        ) AS order_event
                        ORDER BY
                            date,
                            slot_time DIV 2;`;
        const [rows] = await readDB.query(query, [intervalDay, intervalDay]);
        return rows;
    } catch (error) {
        throw error;
    }
}

const getAverageTimeTakenToPickup = async (hubIds, pickupState) => {
    try {
        const query = `SELECT 
                            DATE(CONVERT_TZ(status_date, 'UTC', 'Asia/Kolkata')) AS date,
                            TIMESTAMPDIFF(
                                MINUTE, 
                                    MIN(status_date), MAX(status_date)
                            ) AS sum_between_pickup,
                            COUNT(id) AS total_pickup_req
                        FROM 
                            pickup_request
                        WHERE 
                            hub_id IN (?)
                            AND state IN (?)
                            AND status_date BETWEEN CONVERT_TZ(DATE_FORMAT(CURDATE() - INTERVAL 7 DAY, '%Y-%m-%d 00:00:00'), '+05:30', '+00:00') 
                                AND NOW()
                        GROUP BY date
                        ORDER BY date;`;
        const [rows] = await readDB.query(query, [hubIds, pickupState]);
        return rows;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    getSlotwisePickupCount,
    getAverageTimeTakenToPickup
}