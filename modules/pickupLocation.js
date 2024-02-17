"use strict";

const pickupLocation = require("../models/pickup_location");
const { getAndUpdateLatLng } = require('./locationService')


// Function to save or update pickup location
const saveOrUpdatePickupLocation = async ({ sy_warehouse_id, pickup_contact_name: contact_name, pickup_contact_number: contact_number, pickup_address: address, pickup_state: state, pickup_city: city, pickup_pincode: pincode, seller_id, company_name = null }) => {
    try {
        const warehouseData = {
            sy_warehouse_id,
            contact_name,
            contact_number,
            address,
            state,
            city,
            pincode,
            seller_id,
            company_name,
        };

        // Check if the pickup location already exists
        const [existingPickupLocation] = await pickupLocation.getPickupLocationDetails(sy_warehouse_id);
        if (existingPickupLocation) {
            // If it exists, update the pickup location
            const { id: pickupLocationId, address, city, pincode, lat, lng } = existingPickupLocation;
            //update lat lng in existing pickup location where lat lng is null
            if (!lat && !lng) {
                const fullAddress = [address, city, pincode].join(',');
                if (fullAddress && pickupLocationId) {
                    getAndUpdateLatLng(fullAddress, "pickupLocation", pickupLocationId);
                }
            }
            await pickupLocation.updatePickupLocationById(pickupLocationId, warehouseData);
            return pickupLocationId;
        } else {
            // If it doesn't exist, save a new pickup location
            const newPickupLocation = await pickupLocation.savePickupLocation(warehouseData);
            const pickupLocationId = newPickupLocation?.insertId;
            const fullAddress = [address, city, pincode].join(',');
            if (fullAddress && pickupLocationId) {
                getAndUpdateLatLng(fullAddress, "pickupLocation", pickupLocationId);
            }
            return pickupLocationId;
        }
    } catch (error) {
        console.log(error);
        throw error;
    }
};

module.exports = { saveOrUpdatePickupLocation };
