// src/controllers/sugController.js

const User = require("../models/User");
const Store = require("../models/Store");
const Order = require("../models/Order");
const SugCommission = require("../models/SugCommission");
const StudentRegistry = require("../models/StudentRegistry");
const commissionService = require("../services/commissionService"); // must match actual filename
const { successResponse, errorResponse } = require("../utils/responses");

// ==================== DASHBOARD ====================

exports.getDashboardStats = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: "student", verified: true });
    const totalVendors = await User.countDocuments({ role: "vendor" });
    const activeVendors = await User.countDocuments({ role: "vendor", status: "active" });
    const pendingVendors = await User.countDocuments({ role: "vendor", status: "pending" });
    const totalOrders = await Order.countDocuments({ paymentStatus: "paid" });
    const registrySize = await StudentRegistry.countDocuments();

    const totalStores = await Store.countDocuments();
    const pendingStores = await Store.countDocuments({ isApproved: false, status: "pending" });
    const activeStores = await Store.countDocuments({ isApproved: true, status: "active" });

    const sugId = req.user._id;

    const earningsSummary = await commissionService.getSugEarnings(sugId);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyEarnings = await commissionService.getSugEarnings(sugId, startOfMonth, new Date());

    const recentTransactions = await SugCommission.find({ sugId })
      .populate("orderId", "orderNumber totalAmount")
      .sort({ createdAt: -1 })
      .limit(10);

    return successResponse(res, {
      message: "Dashboard stats retrieved successfully",
      data: {
        statistics: {
          totalStudents,
          totalVendors,
          activeVendors,
          pendingVendors,
          totalOrders,
          registrySize,
          totalStores,
          pendingStores,
          activeStores,
          totalEarnings: earningsSummary.totalEarnings || 0,
          monthlyEarnings: monthlyEarnings.totalEarnings || 0,
        },
        recentTransactions,
      },
    });
  } catch (error) {
    console.error("Get SUG dashboard error:", error);
    return errorResponse(res, error.message || "Failed to get dashboard stats", 500);
  }
};

// ==================== USER MANAGEMENT ====================

exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role = "", status = "", verified = "", search = "" } = req.query;

    const query = {};

    if (role && ["student", "vendor"].includes(role)) {
      query.role = role;
    } else {
      query.role = { $in: ["student", "vendor"] };
    }

    if (status) query.status = status;
    if (verified !== "") query.verified = verified === "true";

    if (search) {
      query.$or = [
        { fullname: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { matricNumber: { $regex: search, $options: "i" } },
        { businessName: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .select("-password");

    const total = await User.countDocuments(query);

    const totalStudents = await User.countDocuments({ role: "student" });
    const totalVendors = await User.countDocuments({ role: "vendor" });
    const pendingVendors = await User.countDocuments({ role: "vendor", status: "pending" });
    const activeVendors = await User.countDocuments({ role: "vendor", status: "active" });

    return successResponse(res, {
      message: "Users retrieved successfully",
      data: {
        users,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum),
          limit: limitNum,
        },
        counts: { totalStudents, totalVendors, pendingVendors, activeVendors },
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    return errorResponse(res, error.message || "Failed to get users", 500);
  }
};

exports.getPendingVendors = async (req, res) => {
  try {
    const pendingVendors = await User.find({
      role: "vendor",
      $or: [{ status: "pending" }, { verified: false }],
    })
      .sort({ createdAt: -1 })
      .select("-password");

    return successResponse(res, {
      message: "Pending vendors retrieved successfully",
      data: { vendors: pendingVendors, count: pendingVendors.length },
    });
  } catch (error) {
    console.error("Get pending vendors error:", error);
    return errorResponse(res, error.message || "Failed to get pending vendors", 500);
  }
};

exports.approveVendor = async (req, res) => {
  try {
    const { userId } = req.params;
    const { approved, notes } = req.body;

    const user = await User.findById(userId);
    if (!user) return errorResponse(res, "User not found", 404);
    if (user.role !== "vendor") return errorResponse(res, "User is not a vendor", 400);

    if (approved) {
      user.verified = true;
      user.status = "active";
    } else {
      user.verified = false;
      user.status = "suspended";
    }

    // optionally store notes if you have a field; otherwise ignore
    await user.save();

    return successResponse(res, {
      message: `Vendor ${approved ? "approved" : "rejected"} successfully`,
      data: { user },
    });
  } catch (error) {
    console.error("Approve vendor error:", error);
    return errorResponse(res, error.message || "Failed to approve vendor", 500);
  }
};

exports.verifyStudent = async (req, res) => {
  try {
    const { userId } = req.params;
    const { verified } = req.body;

    const user = await User.findById(userId);
    if (!user) return errorResponse(res, "User not found", 404);
    if (user.role !== "student") return errorResponse(res, "User is not a student", 400);

    user.verified = !!verified;
    user.status = verified ? "active" : "pending";
    await user.save();

    return successResponse(res, {
      message: `Student ${verified ? "verified" : "unverified"} successfully`,
      data: { user },
    });
  } catch (error) {
    console.error("Verify student error:", error);
    return errorResponse(res, error.message || "Failed to verify student", 500);
  }
};

// ==================== STORE MANAGEMENT ====================

exports.getAllStores = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const { status, isApproved, search } = req.query;

    const query = {};
    if (status) query.status = status;

    if (isApproved !== undefined && isApproved !== "") {
      query.isApproved = isApproved === "true";
    }

    if (search) {
      query.$or = [
        { storeName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const stores = await Store.find(query)
      .populate("owner", "fullname email phone businessName")
      .populate("approvedBy", "fullname")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Store.countDocuments(query);

    const pendingCount = await Store.countDocuments({ isApproved: false, status: "pending" });
    const activeCount = await Store.countDocuments({ isApproved: true, status: "active" });
    const suspendedCount = await Store.countDocuments({ status: "suspended" });
    const totalCount = await Store.countDocuments();

    return successResponse(res, {
      message: "Stores retrieved successfully",
      data: {
        stores,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        counts: { pending: pendingCount, active: activeCount, suspended: suspendedCount, total: totalCount },
      },
    });
  } catch (error) {
    console.error("Get stores error:", error);
    return errorResponse(res, error.message || "Failed to get stores", 500);
  }
};

exports.getPendingStores = async (req, res) => {
  try {
    const stores = await Store.find({ isApproved: false, status: "pending" })
      .populate("owner", "fullname email phone businessName")
      .sort({ createdAt: -1 });

    return successResponse(res, {
      message: "Pending stores retrieved successfully",
      data: { stores, count: stores.length },
    });
  } catch (error) {
    console.error("Get pending stores error:", error);
    return errorResponse(res, error.message || "Failed to get pending stores", 500);
  }
};

exports.getStoreDetails = async (req, res) => {
  try {
    const { storeId } = req.params;

    const store = await Store.findById(storeId)
      .populate("owner", "fullname email phone businessName department faculty")
      .populate("approvedBy", "fullname");

    if (!store) return errorResponse(res, "Store not found", 404);

    return successResponse(res, { message: "Store retrieved successfully", data: { store } });
  } catch (error) {
    console.error("Get store details error:", error);
    return errorResponse(res, error.message || "Failed to get store", 500);
  }
};

exports.approveStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { approved, notes } = req.body;

    const store = await Store.findById(storeId);
    if (!store) return errorResponse(res, "Store not found", 404);

    if (approved) {
      store.isApproved = true;
      store.status = "active";
      store.approvedBy = req.user._id;
      store.approvedAt = new Date();
    } else {
      store.isApproved = false;
      store.status = "suspended";
    }

    await store.save();

    return successResponse(res, {
      message: `Store ${approved ? "approved" : "rejected"} successfully`,
      data: { store },
    });
  } catch (error) {
    console.error("Approve store error:", error);
    return errorResponse(res, error.message || "Failed to update store", 500);
  }
};

exports.updateStoreStatus = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { status } = req.body;

    if (!["active", "suspended", "pending"].includes(status)) {
      return errorResponse(res, "Invalid status value", 400);
    }

    const store = await Store.findById(storeId);
    if (!store) return errorResponse(res, "Store not found", 404);

    store.status = status;

    if (status === "active" && !store.isApproved) {
      store.isApproved = true;
      store.approvedBy = req.user._id;
      store.approvedAt = new Date();
    }

    await store.save();

    return successResponse(res, { message: `Store status updated to ${status}`, data: { store } });
  } catch (error) {
    console.error("Update store status error:", error);
    return errorResponse(res, error.message || "Failed to update store status", 500);
  }
};

// ==================== REPORTS ====================

exports.getCommissionEarnings = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const sugId = req.user._id;

    const earnings = await commissionService.getSugEarnings(
      sugId,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );

    const breakdown = await SugCommission.aggregate([
      {
        $match: {
          sugId,
          ...(startDate && endDate
            ? { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } }
            : {}),
        },
      },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
    ]);

    return successResponse(res, {
      message: "Commission earnings retrieved successfully",
      data: { summary: earnings, breakdown },
    });
  } catch (error) {
    console.error("Get commission earnings error:", error);
    return errorResponse(res, error.message || "Failed to get earnings", 500);
  }
};

exports.getTransactionReports = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const { startDate, endDate } = req.query;

    const sugId = req.user._id;

    const query = { sugId };
    if (startDate && endDate) {
      query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const transactions = await SugCommission.find(query)
      .populate("orderId", "orderNumber totalAmount")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await SugCommission.countDocuments(query);

    return successResponse(res, {
      message: "Transaction reports retrieved successfully",
      data: {
        transactions,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("Get transaction reports error:", error);
    return errorResponse(res, error.message || "Failed to get reports", 500);
  }
};