// src/controllers/adminController.js

const User = require('../models/User');
const Store = require('../models/Store');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const CommissionSetting = require('../models/CommissionSetting');
const commissionService = require('../services/CommissionService');
const { successResponse, errorResponse } = require('../utils/responses');

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
exports.getDashboardStats = async (req, res) => {
  try {
    // User statistics
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalVendors = await User.countDocuments({ role: 'vendor' });

    // Store statistics
    const totalStores = await Store.countDocuments();
    const activeStores = await Store.countDocuments({ status: 'active', isApproved: true });
    const pendingStores = await Store.countDocuments({ status: 'pending', isApproved: false });

    // Product statistics
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: 'active' });

    // Order statistics
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: 'pending' });
    const deliveredOrders = await Order.countDocuments({ orderStatus: 'delivered' });

    // Revenue statistics
    const revenueStats = await Payment.aggregate([
      { $match: { status: 'success' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalTransactions: { $sum: 1 }
        }
      }
    ]);

    const platformRevenue = await commissionService.getPlatformRevenue();

    // Recent activities
    const recentOrders = await Order.find()
      .populate('buyerId', 'fullname email')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentUsers = await User.find()
      .select('fullname email role createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    successResponse(res, {
      message: 'Dashboard stats retrieved successfully',
      data: {
        statistics: {
          users: {
            total: totalUsers,
            students: totalStudents,
            vendors: totalVendors
          },
          stores: {
            total: totalStores,
            active: activeStores,
            pending: pendingStores
          },
          products: {
            total: totalProducts,
            active: activeProducts
          },
          orders: {
            total: totalOrders,
            pending: pendingOrders,
            delivered: deliveredOrders
          },
          revenue: {
            total: revenueStats[0]?.totalRevenue || 0,
            transactions: revenueStats[0]?.totalTransactions || 0,
            platformRevenue: platformRevenue.totalRevenue
          }
        },
        recentActivities: {
          orders: recentOrders,
          users: recentUsers
        }
      }
    });

  } catch (error) {
    console.error('Get admin dashboard error:', error);
    errorResponse(res, error.message || 'Failed to get dashboard stats', 500);
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin)
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { role, status, search } = req.query;

    let query = {};

    if (role) {
      query.role = role;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { fullname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { matricNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await User.countDocuments(query);

    successResponse(res, {
      message: 'Users retrieved successfully',
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    errorResponse(res, error.message || 'Failed to get users', 500);
  }
};

// @desc    Update user status
// @route   PUT /api/admin/users/:userId/status
// @access  Private (Admin)
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, notes } = req.body;

    if (!['active', 'suspended', 'pending'].includes(status)) {
      return errorResponse(res, 'Invalid status', 400);
    }

    const user = await User.findById(userId);

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    if (user.role === 'admin') {
      return errorResponse(res, 'Cannot modify admin status', 403);
    }

    user.status = status;
    await user.save();

    // If vendor is suspended, suspend their store too
    if (user.role === 'vendor' && status === 'suspended') {
      await Store.updateMany(
        { owner: userId },
        { status: 'suspended' }
      );
    }

    successResponse(res, {
      message: 'User status updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update user status error:', error);
    errorResponse(res, error.message || 'Failed to update user status', 500);
  }
};

// @desc    Get all stores
// @route   GET /api/admin/stores
// @access  Private (Admin)
exports.getAllStores = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status, isApproved, search } = req.query;

    let query = {};

    if (status) {
      query.status = status;
    }

    if (isApproved !== undefined) {
      query.isApproved = isApproved === 'true';
    }

    if (search) {
      query.$or = [
        { storeName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const stores = await Store.find(query)
      .populate('owner', 'fullname email phone')
      .populate('approvedBy', 'fullname')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Store.countDocuments(query);

    successResponse(res, {
      message: 'Stores retrieved successfully',
      data: {
        stores,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get stores error:', error);
    errorResponse(res, error.message || 'Failed to get stores', 500);
  }
};

// @desc    Update store status
// @route   PUT /api/admin/stores/:storeId/status
// @access  Private (Admin)
exports.updateStoreStatus = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { status, isApproved } = req.body;

    const store = await Store.findById(storeId);

    if (!store) {
      return errorResponse(res, 'Store not found', 404);
    }

    if (status) {
      store.status = status;
    }

    if (isApproved !== undefined) {
      store.isApproved = isApproved;
      store.approvedBy = isApproved ? req.user.id : null;
      store.approvedAt = isApproved ? new Date() : null;
    }

    await store.save();

    successResponse(res, {
      message: 'Store status updated successfully',
      data: { store }
    });

  } catch (error) {
    console.error('Update store status error:', error);
    errorResponse(res, error.message || 'Failed to update store status', 500);
  }
};

// @desc    Get commission settings
// @route   GET /api/admin/commission-settings
// @access  Private (Admin)
exports.getCommissionSettings = async (req, res) => {
  try {
    const settings = await commissionService.getCommissionSettings();

    successResponse(res, {
      message: 'Commission settings retrieved successfully',
      data: { settings }
    });

  } catch (error) {
    console.error('Get commission settings error:', error);
    errorResponse(res, error.message || 'Failed to get commission settings', 500);
  }
};

// @desc    Update commission settings
// @route   PUT /api/admin/commission-settings
// @access  Private (Admin)
exports.updateCommissionSettings = async (req, res) => {
  try {
    const { vendorPercentage, sugPercentage, platformPercentage } = req.body;

    // Validate percentages
    if (vendorPercentage + sugPercentage + platformPercentage !== 100) {
      return errorResponse(res, 'Total percentages must equal 100%', 400);
    }

    // Deactivate all previous settings
    await CommissionSetting.updateMany({}, { isActive: false });

    // Create new settings
    const settings = await CommissionSetting.create({
      vendorPercentage,
      sugPercentage,
      platformPercentage,
      updatedBy: req.user.id,
      isActive: true
    });

    successResponse(res, {
      message: 'Commission settings updated successfully',
      data: { settings }
    });

  } catch (error) {
    console.error('Update commission settings error:', error);
    errorResponse(res, error.message || 'Failed to update commission settings', 500);
  }
};

// @desc    Get platform revenue
// @route   GET /api/admin/revenue
// @access  Private (Admin)
exports.getPlatformRevenue = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const revenue = await commissionService.getPlatformRevenue(
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );

    successResponse(res, {
      message: 'Platform revenue retrieved successfully',
      data: { revenue }
    });

  } catch (error) {
    console.error('Get platform revenue error:', error);
    errorResponse(res, error.message || 'Failed to get platform revenue', 500);
  }
};

// @desc    Get analytics
// @route   GET /api/admin/analytics
// @access  Private (Admin)
exports.getAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Orders over time
    const ordersOverTime = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Revenue over time
    const revenueOverTime = await Payment.aggregate([
      {
        $match: {
          status: 'success',
          paidAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paidAt' },
            month: { $month: '$paidAt' },
            day: { $dayOfMonth: '$paidAt' }
          },
          totalRevenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Top selling products
    const topProducts = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.subtotal' }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' }
    ]);

    // Top vendors
    const topVendors = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.vendorId',
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$items.subtotal' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'vendor'
        }
      },
      { $unwind: '$vendor' }
    ]);

    successResponse(res, {
      message: 'Analytics retrieved successfully',
      data: {
        ordersOverTime,
        revenueOverTime,
        topProducts,
        topVendors
      }
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    errorResponse(res, error.message || 'Failed to get analytics', 500);
  }
};