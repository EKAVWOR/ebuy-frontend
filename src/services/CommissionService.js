// src/services/commissionService.js
const mongoose = require("mongoose");
const CommissionSetting = require("../models/CommissionSetting");
const SugCommission = require("../models/SugCommission");
const PlatformRevenue = require("../models/PlatformRevenue");

class CommissionService {
  async getPlatformRevenue(startDate = null, endDate = null) {
    try {
      const match = {};

      if (startDate && endDate) {
        match.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      const agg = await PlatformRevenue.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" }, // change if PlatformRevenue uses a different field
            totalRecords: { $sum: 1 },
          },
        },
      ]);

      return agg[0] || { totalRevenue: 0, totalRecords: 0 };
    } catch (error) {
      console.error("Get platform revenue error:", error);
      throw new Error("Failed to get platform revenue");
    }
  }

  async getTotalSugRevenue(startDate = null, endDate = null) {
    try {
      const match = {
        status: { $in: ["confirmed", "paid"] },
      };

      // Date range: prefer paidAt; fallback to createdAt if paidAt missing/null
      if (startDate && endDate) {
        match.$or = [
          { paidAt: { $gte: new Date(startDate), $lte: new Date(endDate) } },
          {
            paidAt: { $exists: false },
            createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
          },
          {
            paidAt: null,
            createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
          },
        ];
      }

      const agg = await SugCommission.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
            totalOrders: { $sum: 1 },
          },
        },
      ]);

      return agg[0] || { totalRevenue: 0, totalOrders: 0 };
    } catch (error) {
      console.error("Get total SUG revenue error:", error);
      throw new Error("Failed to get total SUG revenue");
    }
  }

  async getSugEarnings(sugId, startDate, endDate) {
    try {
      const sugObjectId =
        typeof sugId === "string" ? new mongoose.Types.ObjectId(sugId) : sugId;

      const match = {
        sugId: sugObjectId,
        status: { $in: ["confirmed", "paid"] },
      };

      if (startDate && endDate) {
        match.$or = [
          { paidAt: { $gte: new Date(startDate), $lte: new Date(endDate) } },
          {
            paidAt: { $exists: false },
            createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
          },
          {
            paidAt: null,
            createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
          },
        ];
      }

      const earnings = await SugCommission.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: "$amount" },
            totalOrders: { $sum: 1 },
            avgCommission: { $avg: "$amount" },
          },
        },
      ]);

      return (
        earnings[0] || {
          totalEarnings: 0,
          totalOrders: 0,
          avgCommission: 0,
        }
      );
    } catch (error) {
      console.error("Get SUG earnings error:", error);
      throw new Error("Failed to get SUG earnings");
    }
  }

  async getCommissionSettings() {
    try {
      return await CommissionSetting.findOne({ isActive: true }).sort({ createdAt: -1 });
    } catch (error) {
      console.error("Get commission settings error:", error);
      throw new Error("Failed to get commission settings");
    }
  }
}

module.exports = new CommissionService();