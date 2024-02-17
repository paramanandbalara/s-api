const routes = require("../models/routes");


const initializeRoutes = async () => {
    try {
        let savedRoutesSet = new Set();
        let newRoutesSet = new Set();
        let savedRoutes = await routes.getSavedRoutes();
        savedRoutes.forEach((item) => {
            savedRoutesSet.add(item.route);
        }); //console.log(__line,setRoutes)
        //these routes need not be added to routes table 
        let hiddenRoutes = [
          '/*',
          '/users/login',
          '/changepassword',
          '/users/changepassword',
          '/applogout',
          '/checksession',
          '/users/verifyotp',
          '/order/recevie',
          '/order/create',
          '/checkServiceability',
          '/getTracking',
          '/hub/gateway/code',
          '/citywise/hub/list',
          '/cities',
          '/pickup/details',
          '/pickup/sendotp',
          '/pickup/verify',
          '/pickup/signatureverify',
          '/pickup/complete',
          '/map/rider/tracking',
          '/rider/scan/trackingUpdate',
          '/rider/checkin/riderimage',
          '/rider/checkin',
          '/rider/checkout',
          '/rider/trips/events',
          '/rider/checkin/status',
          '/dashboard/userswisehub/list',
          '/failure/reason',
          '/transporter/list',
          '/pincode/list',
          '/deliver-order',
          '/checkServiceability/pickup',
          '/checkServiceability/delivery',
          '/ping',
          '/startdeployment',
          '/pingdom',
          '/rider/scan/deliveryupdate',
          '/delivery/complete',
          '/delivery/details',
          '/deliver-order',
          '/routeassignment/deliverytrip',
          '/routeassignment/deliveryorder',
          '/routeassignment/delivery/timeline',
          '/delivery/details',
          '/delivery/sendotp',
          '/delivery/verify',
          '/delivery/signatureverify',
          '/delivery/count',
          '/pickup/count',
          '/failure/reason/deliver',
          '/forgotpassword/sendotp',
          '/forgotpassword/verifyotp',
          '/forgotpassword/changepassword',
          '/routeassignment/pickuprequest/details/warehouse',
          '/routeassignment/pickup/orders/timeline',
          '/routeassignment/pickup/details',
          '/hub/wise/riderlist',
          '/routeassignment/delivery/details',
          '/routeassignment/delivery/orders/timeline',
          '/routeassignment/deliveryrequest/details/warehouse',
          '/confirm-sns-subscription',
          '/orders/delivery/list',
          '/orders/order/delivery/tracking',
          '/linehaul/awb/image',
          '/linehaul/details',
          '/rider/submit/securepickup',
          '/rider/checksecurepickup',
          '/rider/uploadsecurepickupimage/item',
          '/rider/uploadsecurepickupimage/parcel',
          '/orders/eway-billno/update',
          '/orders/eway-billno/details',
          '/reports/add-or-remove-favourite',
          '/reports/list',
          '/all-rider-list',
          '/all-user-list',
          '/all-hub-list',
          '/zone-enabled-hub-list',
          'zone/zone-list',
          '/vehicle/vehicles-list',
          '/auto-assign/is-enable'
        ];
        

        for (let item of setRoutes.keys()) {
            if (!savedRoutesSet.has(item)) {
                if (!hiddenRoutes.includes(item))
                    newRoutesSet.add(item)
            }
        }
        let arr = [];
        for (let item of newRoutesSet.keys()) {
            arr.push(`("${item}")`)
        }
        let newRoutes = arr.join(',');
        await routes.setNewRoutes(newRoutes);
    } catch (err) {
        console.log(err);
    }
}

module.exports = {
    initializeRoutes
}