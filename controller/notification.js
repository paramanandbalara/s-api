'use strict';
const notificationModel = require('../models/notification');
const CsvWriter = require('../modules/csvWriter');
const S3Module = require('../modules/s3');
const os = require('os');
const dayjs = require('dayjs');

class Notification {
  async unusualRiderKmNotification(userId) {
    try {
      const currentDayOfWeek = new Date().getDay();
      const intervalDay = currentDayOfWeek === 1 ? 2 : 1;
      const riderUnusualKm = await notificationModel.riderUnusualKm(
        userId,
        intervalDay
      );
      return riderUnusualKm.map((element) => ({
        ...element,
        type: 'riderUnusualKm'
      }));
    } catch (error) {
      console.error(__line, error);
      throw error;
    }
  }

  async riderLessPickupNotification(userId) {
    try {
      const currentDayOfWeek = new Date().getDay();
      const intervalDay = currentDayOfWeek === 1 ? 2 : 1;
      const riderLessPickup = await notificationModel.riderLessPickup(
        userId,
        intervalDay
      );
      return riderLessPickup.map((element) => ({
        ...element,
        type: 'riderLessPickup'
      }));
    } catch (error) {
      console.error(__line, error);
      throw error;
    }
  }

  async lessBeagSealNotification(userId) {
    try {
      const lowBagSeal = await notificationModel.lowBagSeal(userId);
      return lowBagSeal.map((element) => ({
        ...element,
        type: 'lowBagSeal'
      }));
    } catch (error) {
      console.error(__line, error);
      throw error;
    }
  }

  async mismatchInInscanBaggingOutscan(userId) {
    try {
      const currentDayOfWeek = new Date().getDay();
      const intervalDay = currentDayOfWeek === 1 ? 2 : 1;
      const statusWiseCounts =
        await notificationModel.mismatchInInscanBaggingOutscan(
          userId,
          intervalDay
        );

      return this.getMissMatchEvents(statusWiseCounts);
    } catch (error) {
      console.error(__line, error);
      throw error;
    }
  }

  async airwayBillNotUploaded(userId) {
    try {
      const currentDayOfWeek = new Date().getDay();
      const intervalDay = currentDayOfWeek === 1 ? 2 : 1;
      const airwayBillNotUploadedList =
        await notificationModel.airwayBillNotUploaded(userId, intervalDay);
      return airwayBillNotUploadedList.map((element) => ({
        ...element,
        type: 'airwayBillNotUploaded'
      }));
    } catch (error) {
      console.error(__line, error);
      throw error;
    }
  }

  async getNotificationReport({
    userId,
    startDate,
    endDate,
    notificationName
  }) {
    try {
      const fileName = `${notificationName}-${startDate}-${endDate}.csv`;
      const filePath = `${os.tmpdir()}/${fileName}`;

      const functionsForNotifications = {
        riderUnusualKm: async () => {
          try {
            const data = await notificationModel.riderUnusualKmReport({
              userId,
              startDate,
              endDate
            });
            await this.generateRiderUnusealKmCsv(data, filePath);
          } catch (error) {
            throw error;
          }
        },
        riderLessPickup: async () => {
          try {
            const data = await notificationModel.riderLessPickupReport({
              userId,
              startDate,
              endDate
            });
            await this.generateRiderLessPickupCsv(data, filePath);
          } catch (error) {
            throw error;
          }
        },
        missMatchEvents: async () => {
          try {
            const statusWiseCounts =
              await notificationModel.mismatchInInscanBaggingOutscanReport({
                userId,
                startDate,
                endDate
              });
            const data = this.getMissMatchEvents(statusWiseCounts);
            await this.generateMissMatchEventsCsv(data, filePath);
          } catch (error) {
            throw error;
          }
        },
        airwayBillNotUploadedList: async () => {
          try {
            const data = await notificationModel.airwayBillNotUploadedReport({
              userId,
              startDate,
              endDate
            });
            await this.generateAirwayBillNotUploadedListEventsCsv(
              data,
              filePath
            );
          } catch (error) {
            throw error;
          }
        }
      };

      if (!functionsForNotifications[notificationName]) return;

      await functionsForNotifications[notificationName]();

      const s3 = new S3Module();
      const key = `shyptrackreports/notificationReports/${fileName}`;
      await s3.uploadToS3('', key, filePath);
      return { filePath: await s3.getFilePath(key, 360) };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async generateRiderUnusealKmCsv(riderUnusualKm, filePath) {
    try {
      const schema = [
        { header: 'Rider Name', key: 'riderName', coerceString: true },
        { header: 'Hub Code', key: 'hubCode' },
        { header: 'Date', key: 'date', coerceString: true },
        { header: 'Km', key: 'kmDiff', coerceString: true }
      ];
      const csv = new CsvWriter();
      await csv.initialize({ schema, filePath });

      for (const {
        riderName,
        kmDiff,
        hub_code,
        checkin_date
      } of riderUnusualKm) {
        const row = {
          riderName,
          hubCode: hub_code,
          date: dayjs(checkin_date).format('DD/MM/YYYY'),
          kmDiff: kmDiff.toString()
        };

        await csv.writeRow(row);
      }
      await csv.closeFile();
    } catch (error) {
      throw error;
    }
  }

  async generateRiderLessPickupCsv(data, filePath) {
    try {
      const schema = [
        { header: 'Rider Name', key: 'riderName', coerceString: true },
        { header: 'Hub Code', key: 'hubCode' },
        { header: 'Date', key: 'date', coerceString: true },
        {
          header: 'TotalcAssigned Pickup Request',
          key: 'totalAssignedPickupRequest',
          coerceString: true
        }
      ];
      const csv = new CsvWriter();
      await csv.initialize({ schema, filePath });

      for (const {
        riderName,
        totalAssignedPickupRequest,
        hub_code,
        createdDate
      } of data) {
        const row = {
          riderName,
          hubCode: hub_code,
          date: dayjs(createdDate).format('DD/MM/YYYY'),
          totalAssignedPickupRequest: totalAssignedPickupRequest.toString()
        };

        await csv.writeRow(row);
      }
      await csv.closeFile();
    } catch (error) {
      throw error;
    }
  }

  async generateMissMatchEventsCsv(data, filePath) {
    try {
      const schema = [{ header: 'Hub Code', key: 'hubCode' }];
      const csv = new CsvWriter();
      await csv.initialize({ schema, filePath });

      for (const { hub_code } of data) {
        const row = {
          hubCode: hub_code
        };

        await csv.writeRow(row);
      }
      await csv.closeFile();
    } catch (error) {
      throw error;
    }
  }

  getMissMatchEvents(statusWiseCounts) {
    const groupedResults = {};

    for (const result of statusWiseCounts) {
      const { hub_id } = result;
      if (!groupedResults[hub_id]) {
        groupedResults[hub_id] = [];
      }
      groupedResults[hub_id].push(result);
    }

    const mismatchEvents = [];

    for (const hub_id in groupedResults) {
      const results = groupedResults[hub_id];
      const eventCounts = results.map(({ event_count }) => event_count);

      if (eventCounts.length !== 3) {
        const mismatch = {
          hub_id,
          hub_code: results[0].hub_code,
          on_date: results[0].on_date,
          type: 'mismatchEvents'
        };
        mismatchEvents.push(mismatch);
        continue;
      }

      if ([...new Set(eventCounts)].length > 1) {
        const mismatch = {
          hub_id,
          hub_code: results[0].hub_code,
          type: 'mismatchEvents'
        };
        mismatchEvents.push(mismatch);
      }
    }

    return mismatchEvents;
  }
  async generateAirwayBillNotUploadedListEventsCsv(data, filePath) {
    try {
      const schema = [{ header: 'Hub Code', key: 'hubCode' }];
      const csv = new CsvWriter();
      await csv.initialize({ schema, filePath });

      for (const { hub_code } of data) {
        const row = {
          hubCode: hub_code
        };

        await csv.writeRow(row);
      }
      await csv.closeFile();
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Notification;
