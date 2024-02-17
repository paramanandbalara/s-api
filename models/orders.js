const dayjs = require('dayjs');

  /*
orders.status values

1. Order Received
2. Cancelled
3. Rider Assigned
4. Picked-up
5. In-scan at origin hub
6. Bagging Completed
7. Departed from origin hub
8. Address locked, pickup pending
9. Package not ready or not handed over
10. Reschdeuled, seller asked to come later
11. Inbound Completed
12. Missing on Inbound at Gateway
13. Damage on Inbound at Gateway
14. Order added to bag
15. Bag Inbound at Gateway
16. Pickup Failed
17. Order Not pickedup
18. Dropped Off at hub
19. Connected Offline to Gateway
100. Order Received
101. Rider Assigned
102. Out for delivery
103. Delivered to consignee
104. Not delivered
105. Delivery failed
20. Pickup Cancelled by Seller
21. Pickup Rescheduled
*/

const getOrders = async (offset, limit, statusIds, filters) => {
  try {
    const {
      manifest_id,
      shypmax_id,
      awb,
      warehouse_id,
      filter_status,
      startDate,
      endDate,
      user_id,
    } = filters;

    const filters_arr = [];
    const filterConditions = [];
    filters_arr.push(user_id);

    let query = `SELECT O.id, O.order_number, O.mode, O.awb, O.shypmax_id, O.order_receive_date, O.package_value, O.status, O.dropoff_hub_id,
                        O.package_weight, O.package_length, O.package_width, O.package_height, O.seller_id, O.route_request_assigned_id, O.eway_billno,
                        PR.pickup_date, PR.pickup_request_no,
                        PL.address as pickup_address, PL.state pickup_state, PL.city pickup_city, 
                        PL.pincode pickup_pincode,PL.contact_number, PL.company_name
                        FROM orders O
                        LEFT JOIN pickup_request PR ON O.pickup_request_id = PR.id
                        INNER JOIN pickup_location PL ON O.sy_warehouse_id = PL.sy_warehouse_id
                        WHERE NOT(O.status = 2 AND O.pickup_request_id IS NULL) AND O.status != 0 AND O.hub_id IN (SELECT hub_id from user_hub WHERE user_id = ?)`;

    if (statusIds.length) {
      filterConditions.push('O.status IN (?)');
      filters_arr.push(statusIds);
    }

    if (manifest_id) {
      filterConditions.push('O.manifest_id = ?');
      filters_arr.push(manifest_id);
    }

    if (shypmax_id) {
      filterConditions.push('O.shypmax_id = ?');
      filters_arr.push(shypmax_id);
    }

    if (awb) {
      filterConditions.push('O.awb = ?');
      filters_arr.push(awb);
    }

    if (warehouse_id) {
      filterConditions.push('O.sy_warehouse_id = ?');
      filters_arr.push(warehouse_id);
    }

    if (filter_status) {
      filterConditions.push('O.status = ?');
      filters_arr.push(filter_status);
    }

    if (startDate && endDate) {
      filterConditions.push('O.order_receive_date BETWEEN ? AND ?');
      filters_arr.push(
        dayjs(startDate).format('YYYY-MM-DD 00:00:00'),
        dayjs(endDate).format('YYYY-MM-DD 23:59:59'),
      );
    }

    if (filterConditions.length) {
      query += ` AND ${filterConditions.join(' AND ')}`;
    }

    if (limit) {
      query += ' ORDER BY O.id DESC LIMIT ?, ?';
      filters_arr.push(offset, limit);
    }
    const [rows] = await readDB.query(query, filters_arr);
    return rows;
  } catch (exception) {
    console.error(exception);
    throw exception;
  }
};

const getOrderDetailByLm = async (awb, condition = ``) => {
  try {
    const query = `SELECT * FROM orders WHERE (awb IN (?) OR shypmax_id IN (?)) ${condition};`;
    const [rows] = await readDB.query(query, [awb, awb]);
    return rows;
  } catch (exception) {
    throw new Error(exception.message);
  }
};

const updateOrderDetails = async (order_ids, update_obj) => {
  try {
    const query = `UPDATE orders SET ? WHERE id IN (?);`;

    const [rows] = await writeDB.query(query, [update_obj, order_ids]);
    return rows;
  } catch (exception) {
    console.error(exception);
    throw new Error(exception.message || exception);
  }
};

const getInscanedOrderByHub = async (hub_id, offset, limit) => {
  try {
    const query = `SELECT * FROM orders WHERE inscan_hub_id = ? AND status = '5' ORDER BY inscan_date DESC LIMIT ?,?;`;
    const [rows] = await readDB.query(query, [hub_id, offset, limit]);

    return rows;
  } catch (exception) {
    throw new Error(exception.message);
  }
};

/**
 *
 * @param {*} fieldNames @type string the fields in  which data needs to be preseent in dataset sequentially as mentioned in fieldnames
 * @param {*} dataSet array of array for multi insert in one go for example : [[1,2,3],[4,5,6]]
 * @returns
 */
const insertData = async (fieldNames, dataSet) => {
  try {
    const query = `INSERT INTO orders (??) VALUES ? 
                        ON DUPLICATE KEY UPDATE 
                            manifest_id = manifest_id, 
                            pickup_request_id= pickup_request_id, 
                            pickup_request_id = CASE WHEN status = 0 THEN VALUES(pickup_request_id) ELSE pickup_request_id END,
                            manifest_id = CASE WHEN status = 0 THEN VALUES(manifest_id) ELSE manifest_id END,
                            route_request_assigned_id = CASE WHEN status = 0 THEN VALUES(route_request_assigned_id) ELSE route_request_assigned_id END,
                            order_receive_date = CASE WHEN status = 0 THEN VALUES(order_receive_date) ELSE order_receive_date END,
                            status = CASE WHEN status = 0 THEN VALUES(status) ELSE status END;`;

    const [rows] = await writeDB.query(query, [fieldNames, dataSet]);
    return rows;
  } catch (error) {
    console.log(error);
    throw Error(error);
  }
};
const updateOrder = async (dataSet, sy_order_id, sellerId) => {
  try {
    const [rows] = await writeDB.query(
      `UPDATE orders SET ? WHERE seller_id = ? AND sy_order_id = ?`,
      [dataSet, sellerId, sy_order_id],
    );

    return;
  } catch (error) {
    console.log(error);
    throw Error(error);
  }
};

const checkWhetherAwbExist = async (awb) => {
  if (!awb) {
    throw new Error('Please enter/scan AWB.');
  }

  try {
    const queryParams = [awb];
    let query = `SELECT id, awb, status AS orderStatus, sy_warehouse_id, pickup_request_id, route_request_assigned_id, sy_warehouse_id, order_date, hub_id, dropoff_hub_id, pickup_delivery, inscan_hub_id, order_receive_date, hub_id, mode, shypmax_id, eway_billno, package_value FROM orders WHERE shypmax_id = ?`;

    // If AWB does not start with 'SHPMX', search in the AWB column as well
    if (!awb.startsWith('SHPMX')) {
      query += ` OR awb = ?`;
      queryParams.push(awb);
    }

    let [result] = await readDB.query(query, queryParams);

    if (!result.length) {
      // Retry the query with different variations of AWB
      if (awb.startsWith('SHPMX')) {
        query += ` OR awb = ?;`;
      }

      [result] = await readDB.query(query, [awb, awb]);

      if (result.length === 0) {
        // Try searching with sliced AWB
        const slicedAwb = awb.slice(8);
        [result] = await readDB.query(query, [slicedAwb, slicedAwb]);
      }

      if (result.length === 0) {
        // Try searching with sliced FedEx AWB
        const slicedFedExAwb = awb.substr(awb.length - 12);
        [result] = await readDB.query(query, [slicedFedExAwb, slicedFedExAwb]);
      }

      if (result.length === 0) {
        // Try searching with sliced AU AWB
        const slicedAuAwb = awb.substr(awb.length - 23);
        [result] = await readDB.query(query, [slicedAuAwb, slicedAuAwb]);
      }
    }

    return result;
  } catch (error) {
    throw error;
  }
};

const checkWhetherAwbExistForTracking = async (trimmedAwbArray) => {
  try {
    const query = `SELECT id,awb,status as orderStatus,sy_warehouse_id,pickup_request_id, route_request_assigned_id, order_date, mode, hub_id, shypmax_id, eway_billno, package_value
                        FROM orders 
                        WHERE awb IN (?);`;
    const [result] = await readDB.query(query, [trimmedAwbArray]);
    return result;
  } catch (exception) {
    throw exception;
  }
};
const getOrdersByBag = async (bag_ids_arr) => {
  try {
    const query = `SELECT * FROM orders WHERE bag_id IN (?);`;
    const [rows] = await readDB.query(query, [bag_ids_arr]);

    return rows;
  } catch (exception) {
    throw new Error(exception.message);
  }
};

const getOrdersByPickupRequestId = async (routeRequestAssignedId) => {
  try {
    const query = `SELECT O.id, O.awb, O.status, pickup_request.state, pickup_request.pickup_request_no, O.mode, O.pickup_assigned_count, O.hub_id, O.shypmax_id FROM orders O
                        INNER JOIN pickup_request ON pickup_request.id = O.pickup_request_id 
                        LEFT JOIN route_request_assigned RRA ON O.route_request_assigned_id = RRA.id
                        WHERE RRA.id IN (?);`;

    const [rows] = await readDB.query(query, [routeRequestAssignedId]);

    return rows;
  } catch (exception) {
    throw new Error(exception.message);
  }
};

const getOrdersByDeliveryRequestId = async (routeRequestAssignedId) => {
  try {
    const query = `SELECT O.id, O.awb, O.status,  delivery_request.state, delivery_request.delivery_request_no, O.hub_id, O.shypmax_id FROM orders O
                        LEFT JOIN delivery_request ON delivery_request.id = O.deliver_request_id 
                        LEFT JOIN route_request_assigned RRA ON O.route_request_assigned_id = RRA.id
                        WHERE RRA.id IN (?);`;

    const [rows] = await readDB.query(query, [routeRequestAssignedId]);

    return rows;
  } catch (exception) {
    throw new Error(exception.message);
  }
};

const getOrderDetailsBySellerIdAndSyOrderId = async (
  sy_order_id,
  seller_id,
) => {
  try {
    const [rows] = await readDB.query(
      `SELECT id,status,awb,pickup_request_id,hub_id FROM orders WHERE sy_order_id = ? AND seller_id = ?;`,
      [sy_order_id, seller_id],
    );
    return rows;
  } catch (error) {
    throw Error(error);
  }
};

const getOrdersTracking = async (id) => {
  try {
    const [rows] = await readDB.query(
      `SELECT oe.remarks, oe.event_created_at, oe.status FROM order_event oe WHERE oe.order_id = ? ORDER BY oe.event_created_at DESC, oe.id DESC;`,
      [id],
    );

    return rows;
  } catch (error) {
    throw Error(error);
  }
};

const getOrdersByPickupRequestIdAndStatus = async (pickupRequestId, status) => {
  try {
    const query = `SELECT id, awb, hub_id, shypmax_id FROM orders WHERE pickup_request_id = ? AND status IN (?);`;
    const [rows] = await readDB.query(query, [pickupRequestId, status]);
    return rows;
  } catch (exception) {
    console.error(exception);
    throw new Error(exception.message || exception);
  }
};

const getOrderByDeliveryReqAndStatus = async (deliveryRequestId, status) => {
  try {
    const query = `SELECT id, awb, hub_id, shypmax_id FROM orders WHERE deliver_request_id = ? AND status IN (?)`;
    const [rows] = await readDB.query(query, [deliveryRequestId, status]);
    return rows;
  } catch (exception) {
    console.error(exception);
    throw new Error(exception.message || exception);
  }
};

const getOrdersByTripId = async (routeRequestAssignedId, status) => {
  try {
    const query = `SELECT id, awb, mode, pickup_assigned_count, hub_id, shypmax_id FROM orders WHERE route_request_assigned_id = ? AND status IN (?)`;
    const [rows] = await readDB.query(query, [routeRequestAssignedId, status]);
    return rows;
  } catch (exception) {
    console.error(exception);
    throw new Error(exception.message || exception);
  }
};

const saveOrderDetails = async (data) => {
  const query = `INSERT INTO orders SET ?;`;
  const [rows] = await writeDB.query(query, [data]);
  return rows;
};

const getDeliveredAwbCount = async (routeRequestAssignedId, riderId) => {
  try {
    const query = `SELECT COUNT(o.id) as delivered_awb_count, DL.contact_name, DL.contact_number, DL.address, 
                        DL.city, DL.state, DL.pincode, VC.otp_based otp_based_arr, VC.signature_based signature_based_arr, VC.hub_id config_hub_id, DR.id deliver_request_id,
                        DR.delivery_request_no,RRA.id route_request_assigned_id, VC.type, VC.status configStatus, DR.hub_id
                        FROM orders o
                        INNER JOIN delivery_request DR ON DR.id = o.deliver_request_id
                        LEFT JOIN route_request_assigned RRA ON DR.id = RRA.deliver_request_id
                        JOIN delivery_location DL ON DR.delivery_location_id = DL.id
                        JOIN user_hub UH ON RRA.rider_id = UH.user_id
                        left JOIN config VC ON UH.hub_id = VC.hub_id
                        WHERE o.status = 103 AND o.route_request_assigned_id = ?
                        AND UH.user_id = ?
                        GROUP BY o.deliver_request_id;`;

    const [rows] = await readDB.query(query, [routeRequestAssignedId, riderId]);

    return rows;
  } catch (exception) {
    throw new Error(exception.message || exception);
  }
};

const getFailedOrNotPickedAwbs = async (stopFailedPickupCount) => {
  try {
    const query = `SELECT id, shypmax_id, awb, order_receive_date, pickup_request_id, hub_id FROM orders WHERE status IN (16, 17) AND pickup_assigned_count <= ?;`;
    const [rows] = await readDB.query(query, [stopFailedPickupCount]);
    return rows;
  } catch (exception) {
    throw new Error(exception.message || exception);
  }
};

const getOrderDetailsByAwbOrShypmaxId = async (shypmaxId, awb) => {
  try {
    const query = `SELECT id, awb, status as orderStatus, sy_warehouse_id, pickup_request_id, route_request_assigned_id, sy_warehouse_id, order_date, hub_id, shypmax_id FROM orders WHERE (shypmax_id IN (?) OR awb IN (?)) ;`;
    const [rows] = await readDB.query(query, [shypmaxId, awb]);
    return rows;
  } catch (exception) {
    console.error(exception);
    throw new Error(exception);
  }
};

const getTotalWeightByRRA = async (routeRequestAssignedId) => {
  try {
    const query = ` SELECT SUM(O.package_weight) totalWeight from orders O WHERE O.awb IN (SELECT DISTINCT(OE.awb) FROM order_event OE WHERE OE.route_request_assigned_id = ?);`;
    const [rows] = await readDB.query(query, [routeRequestAssignedId]);
    return rows;
  } catch (exception) {
    console.error(exception);
    throw exception;
  }
};

const getTotalWeightByPR = async (pickup_request_id) => {
  try {
    const query = ` SELECT SUM(O.package_weight) totalWeight from orders O WHERE O.pickup_request_id = ?;`;
    const [rows] = await readDB.query(query, [pickup_request_id]);
    return rows;
  } catch (exception) {
    console.error(exception);
    throw exception;
  }
};

const deliveryOrderList = async (
  user_id,
  offset,
  limit,
  statusArr,
  filters,
) => {
  try {
    const { rider_id, shypmax_id, awb, startDate, endDate, filter_status } =
      filters;

    const paramsArr = [user_id];

    let query = `SELECT O.source, O.id, O.awb, O.shypmax_id, O.order_number, O.order_receive_date, O.package_length, O.package_weight, O.package_width, O.package_height, O.package_weight, 
        				O.package_value, O.status,
                        DR.delivery_request_no, DL.address delivery_address, DL.city delivery_city, DL.state delivery_state, DL.pincode delivery_pincode, DL.contact_name
                        , U.name as rider_name
                        FROM orders O
                        LEFT JOIN delivery_request DR ON DR.id = O.deliver_request_id
                        INNER JOIN delivery_location DL ON DL.consignee_address_id = O.sy_warehouse_id
                        INNER JOIN user_hub UH ON O.hub_id = UH.hub_id
                        LEFT JOIN route_request_assigned RRA ON O.route_request_assigned_id = RRA.id
                        LEFT JOIN users U ON RRA.rider_id = U.id
                        WHERE UH.user_id = ? AND O.pickup_delivery = 2 `;
    if (statusArr.length) {
      query += ` AND O.status IN (?)`;
      paramsArr.push(statusArr);
    }

    if (rider_id) {
      query += ` AND route_request_assigned.rider_id = ?`;
      paramsArr.push(rider_id);
    }

    if (shypmax_id) {
      query += ` AND O.shypmax_id = ?`;
      paramsArr.push(shypmax_id);
    }

    if (awb) {
      query += ` AND O.awb = ?`;
      paramsArr.push(awb);
    }

    if (startDate && endDate) {
      query += ` AND O.order_receive_date BETWEEN ? AND ?`;
      paramsArr.push(dayjs(filters?.startDate).format('YYYY-MM-DD 00:00:00'));
      paramsArr.push(dayjs(filters?.endDate).format('YYYY-MM-DD 23:59:59'));
    }
    if (filter_status) {
      query += ` AND O.status = ?`;
      paramsArr.push(filter_status);
    }

    if (limit) {
      query += ` ORDER BY O.created DESC LIMIT ?,?;`;
      paramsArr.push(offset, limit);
    }

    const [rows] = await readDB.query(query, paramsArr);

    return rows;
  } catch (exception) {
    throw new Error(exception.message);
  }
};

const getTotalAmountOfAssignedPickup = async (riderId) => {
  try {
    const query = `SELECT SUM(O.package_value) totalAmt FROM orders O
                            INNER JOIN route_request_assigned RRA ON RRA.id = O.route_request_assigned_id
                            INNER JOIN pickup_request PR ON RRA.pickup_request_id = PR.id
                            WHERE RRA.rider_id = ? AND RRA.status = 0 AND PR.secured_pickup = 1;`;
    const [rows] = await readDB.query(query, [riderId]);
    return rows;
  } catch (exception) {
    throw exception;
  }
};

const getStatusWiseOrderCount = async (status, startDate, endDate) => {
  try {
    const query = `SELECT COUNT(id) orderCount FROM order_event WHERE status IN (?) AND event_created_at BETWEEN ? AND  ?;`;
    const [rows] = await readDB.query(query, [status, startDate, endDate]);
    if (!rows.length) return [{ pickupOrderCount: 0 }];
    return rows;
  } catch (exception) {
    console.error(exception);
    throw new Error(exception);
  }
};

const getRiderNameAndFailureReason = async (routeRequestIds) => {
  try {
    const query = `SELECT RRA.id AS route_request_assigned_id, U.name as rider_name, FR.failure_reason FROM route_request_assigned RRA 
                        INNER JOIN users U ON RRA.rider_id = U.id
                        LEFT JOIN failure_reason FR ON RRA.failure_reason = FR.id
                        WHERE RRA.id IN (?);`;
    const [rows] = await readDB.query(query, [routeRequestIds]);
    return rows;
  } catch (exception) {
    throw exception;
  }
};

const updateOrderWithFailedCounts = async ({
  routeRequestAssignedId,
  pickup_request_id,
  orderStatus,
  orderIdsToBeUpdate,
  stopFailedPickupCount,
}) => {
  try {
    const query = `UPDATE orders
                            SET pickup_assigned_count = 
                                CASE
                                    WHEN pickup_assigned_count > ? THEN pickup_assigned_count
                                    ELSE pickup_assigned_count + 1
                                END,
                                route_request_assigned_id = CASE
                                    WHEN pickup_assigned_count > ? THEN NULL
                                    ELSE ?
                                END,
                                pickup_request_id = CASE
                                    WHEN pickup_assigned_count > ? THEN NULL
                                    ELSE ?
                                END,
                                status = CASE
                                    WHEN pickup_assigned_count > ? AND mode != 'FBA Pro' THEN 20
                                    ELSE ?
                                END
                            WHERE id IN (?);`;
    const [rows] = await writeDB.query(query, [
      stopFailedPickupCount,
      stopFailedPickupCount,
      routeRequestAssignedId,
      stopFailedPickupCount,
      pickup_request_id,
      stopFailedPickupCount,
      orderStatus,
      orderIdsToBeUpdate,
    ]);
    return rows;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const getPickupRequestAndStatusWiseOrdersbyHubId = async (
  status,
  startDate,
  endDate,
  hubIds,
) => {
  try {
    const query = `SELECT COUNT(OE.id) orderCount FROM order_event OE INNER JOIN orders O ON O.id = OE.order_id WHERE OE.status IN (?) AND event_created_at BETWEEN ? AND  ? AND O.hub_id IN (?);`;
    const [rows] = await readDB.query(query, [
      status,
      startDate,
      endDate,
      hubIds,
    ]);
    return rows;
  } catch (exception) {
    console.error(exception);
    throw new Error(exception);
  }
};

module.exports = {
  getOrders,
  updateOrderDetails,
  getInscanedOrderByHub,
  updateOrder,
  checkWhetherAwbExist,
  getOrdersByBag,
  getOrdersByPickupRequestId,
  getOrderDetailsBySellerIdAndSyOrderId,
  getOrdersTracking,
  insertData,
  getOrdersByPickupRequestIdAndStatus,
  getOrdersByTripId,
  checkWhetherAwbExistForTracking,
  saveOrderDetails,
  getOrdersByTripId,
  getOrderByDeliveryReqAndStatus,
  getOrdersByDeliveryRequestId,
  getDeliveredAwbCount,
  getFailedOrNotPickedAwbs,
  getOrderDetailsByAwbOrShypmaxId,
  getOrderDetailByLm,
  getTotalWeightByRRA,
  deliveryOrderList,
  getTotalAmountOfAssignedPickup,
  getTotalWeightByPR,
  getStatusWiseOrderCount,
  getRiderNameAndFailureReason,
  updateOrderWithFailedCounts,
  getPickupRequestAndStatusWiseOrdersbyHubId,
  // getPendingAndUnassignOrdersByPickupRequestId,
};
