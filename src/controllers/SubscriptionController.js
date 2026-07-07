// src/controllers/subscriptionController.js

const subscriptionService = require('../services/SubscriptionService');
const Subscription = require('../models/Subscription');
const { successResponse, errorResponse } = require('../utils/responses');

// @desc    Get available subscription plans
// @route   GET /api/subscriptions/plans
// @access  Public
exports.getPlans = async (req, res) => {
  try {
    const plans = subscriptionService.getAvailablePlans();

    successResponse(res, {
      message: 'Subscription plans retrieved',
      data: { plans }
    });

  } catch (error) {
    console.error('Get plans error:', error);
    errorResponse(res, error.message, 500);
  }
};

// @desc    Initialize subscription
// @route   POST /api/subscriptions/initialize
// @access  Private (Vendor)
exports.initializeSubscription = async (req, res) => {
  try {
    const { plan } = req.body;

    if (!plan || !['basic', 'standard', 'premium'].includes(plan)) {
      return errorResponse(res, 'Invalid subscription plan', 400);
    }

    const result = await subscriptionService.initializeSubscription(
      req.user.id,
      plan,
      req.user.email
    );

    successResponse(res, {
      message: 'Subscription initialized successfully',
      data: {
        authorizationUrl: result.authorizationUrl,
        reference: result.reference,
        subscription: result.subscription
      }
    }, 201);

  } catch (error) {
    console.error('Initialize subscription error:', error);
    errorResponse(res, error.message, 500);
  }
};

// @desc    Verify subscription payment
// @route   GET /api/subscriptions/verify/:reference
// @access  Private (Vendor)
exports.verifySubscription = async (req, res) => {
  try {
    const { reference } = req.params;

    const result = await subscriptionService.verifySubscriptionPayment(reference);

    successResponse(res, {
      message: result.alreadyVerified ? 'Already verified' : 'Subscription activated successfully',
      data: {
        subscription: result.subscription,
        alreadyVerified: result.alreadyVerified
      }
    });

  } catch (error) {
    console.error('Verify subscription error:', error);
    errorResponse(res, error.message, 500);
  }
};

// @desc    Get vendor's current subscription
// @route   GET /api/subscriptions/my-subscription
// @access  Private (Vendor)
exports.getMySubscription = async (req, res) => {
  try {
    const subscription = await subscriptionService.getVendorSubscription(req.user.id);

    if (!subscription) {
      return successResponse(res, {
        message: 'No subscription found',
        data: { subscription: null }
      });
    }

    successResponse(res, {
      message: 'Subscription retrieved',
      data: { subscription }
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    errorResponse(res, error.message, 500);
  }
};

// @desc    Get subscription history
// @route   GET /api/subscriptions/history
// @access  Private (Vendor)
exports.getSubscriptionHistory = async (req, res) => {
  try {
    const subscriptions = await subscriptionService.getSubscriptionHistory(req.user.id);

    successResponse(res, {
      message: 'Subscription history retrieved',
      data: { subscriptions }
    });

  } catch (error) {
    console.error('Get history error:', error);
    errorResponse(res, error.message, 500);
  }
};

// @desc    Renew subscription
// @route   POST /api/subscriptions/renew
// @access  Private (Vendor)
exports.renewSubscription = async (req, res) => {
  try {
    const result = await subscriptionService.renewSubscription(
      req.user.id,
      req.user.email
    );

    successResponse(res, {
      message: 'Subscription renewal initiated',
      data: {
        authorizationUrl: result.authorizationUrl,
        reference: result.reference
      }
    });

  } catch (error) {
    console.error('Renew subscription error:', error);
    errorResponse(res, error.message, 500);
  }
};

// @desc    Get all subscriptions (Admin)
// @route   GET /api/subscriptions/admin/all
// @access  Private (Admin)
exports.getAllSubscriptions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status, plan } = req.query;

    let query = {};
    if (status) query.status = status;
    if (plan) query.plan = plan;

    const subscriptions = await Subscription.find(query)
      .populate('vendorId', 'fullname email')
      .populate('storeId', 'storeName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Subscription.countDocuments(query);

    // Get stats
    const stats = await subscriptionService.getSubscriptionStats();

    successResponse(res, {
      message: 'Subscriptions retrieved',
      data: {
        subscriptions,
        statistics: stats,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get all subscriptions error:', error);
    errorResponse(res, error.message, 500);
  }
};

// @desc    Get subscription statistics (Admin)
// @route   GET /api/subscriptions/admin/stats
// @access  Private (Admin)
exports.getSubscriptionStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await subscriptionService.getSubscriptionStats(startDate, endDate);

    // Calculate totals
    const totalRevenue = stats.byStatus.reduce((sum, s) => sum + s.totalRevenue, 0);
    const totalSubscriptions = stats.byStatus.reduce((sum, s) => sum + s.count, 0);
    const activeSubscriptions = stats.byStatus.find(s => s._id === 'active')?.count || 0;

    successResponse(res, {
      message: 'Statistics retrieved',
      data: {
        totalRevenue,
        totalSubscriptions,
        activeSubscriptions,
        byStatus: stats.byStatus,
        byPlan: stats.byPlan
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    errorResponse(res, error.message, 500);
  }
};