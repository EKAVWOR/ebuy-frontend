// src/services/commissionService.js
const mongoose = require("mongoose");
const CommissionSetting = require("../models/CommissionSetting");
const SugCommission = require("../models/SugCommission");
const PlatformRevenue = require("../models/PlatformRevenue");
const VendorWallet = require("../models/VendorWallet");
const Order = require("../models/Order");
const User = require("../models/User");

class CommissionService {
  // ... keep your other methods as they are ...

  /**
   * Get SUG earnings summary
   * ✅ FIX: cast sugId to ObjectId for aggregation match
   * ✅ FIX: include confirmed + paid by default
   * ✅ FIX: date range uses paidAt if available, otherwise createdAt fallback
   */
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
          // preferred: use paidAt if set
          { paidAt: { $gte: new Date(startDate), $lte: new Date(endDate) } },

          // fallback: if paidAt missing/null, use createdAt
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
}

module.exports = new CommissionService();