const { getUserFavourites, updateUsersFavReports } = require('../models/users');
const reportModel = require('../models/reports')

class Reports {
    async addOrRemoveToFavourite(userId, { reportId, value }) {
        try {
            const [usersFavourite] = await getUserFavourites(userId);
            const { fav_setting: favSettings } = usersFavourite || {};
            const { reports_fav: reportsFav = '' } = favSettings || {};

            const existingFavouriteReports = reportsFav ? reportsFav.split(",").map(Number) : [];
            //value 1 means starred 0 means unstarred
            const updatedFavReportsString = value ? this.addNewReportToFavourite(reportId, existingFavouriteReports) :
                this.removeReportFromFavourite(reportId, existingFavouriteReports);

            await updateUsersFavReports(userId, updatedFavReportsString);
        } catch (error) {
            throw error;
        }
    }

    addNewReportToFavourite(reportId, existingFavouriteReports) {
        !existingFavouriteReports.includes(reportId) && existingFavouriteReports.push(reportId);
        return existingFavouriteReports.sort().join(',');
    }

    removeReportFromFavourite(reportId, existingFavouriteReports) {
        const index = existingFavouriteReports.indexOf(reportId);
        index !== -1 && existingFavouriteReports.splice(index, 1);
        return existingFavouriteReports.sort().join(',');
    }


    async getReportList(userId) {
        try {
            const [allReportList, [favouriteReports]] = await Promise.all([
                reportModel.getAllReportList(),
                getUserFavourites(userId)
            ]);
            const { fav_setting: favSettings } = favouriteReports || {};
            const { reports_fav: reportsFav = '' } = favSettings || {};
            const favouriteReportIds = reportsFav ? reportsFav.split(",").map(Number) : [];
            return {
                allReportList, favouriteReportIds
            }
        } catch (error) {
            throw error;
        }
    }

}

module.exports = Reports;