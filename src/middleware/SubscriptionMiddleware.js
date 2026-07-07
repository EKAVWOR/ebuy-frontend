// src/middleware/subscriptionMiddleware.js

const subscriptionService = require('../services/SubscriptionService');
const Product = require('../models/Product');
const { errorResponse } = require('../utils/responses');

/**
 * Check if vendor has active subscription before creating store
 */
exports.requireActiveSubscription = async (req, res, next) => {
  try {
    const canCreate = await subscriptionService.canCreateStore(req.user.id);

    if (!canCreate) {
      return errorResponse(
        res,
        'Active subscription required to create or manage a store. Please subscribe to a plan.',
        403
      );
    }

    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    return errorResponse(res, 'Failed to verify subscription', 500);
  }
};

/**
 * Check product limits before adding products
 */
exports.checkProductLimit = async (req, res, next) => {
  try {
    // Get current product count for vendor
    const productCount = await Product.countDocuments({ vendorId: req.user.id });

    const result = await subscriptionService.canAddProducts(req.user.id, productCount);

    if (!result.canAdd) {
      return errorResponse(
        res,
        result.reason,
        403,
        { 
          currentCount: productCount,
          limit: result.limit
        }
      );
    }

    // Attach remaining count to request for informational purposes
    req.subscriptionInfo = {
      remaining: result.remaining,
      limit: result.limit
    };

    next();
  } catch (error) {
    console.error('Product limit check error:', error);
    return errorResponse(res, 'Failed to verify product limits', 500);
  }
};

/**
 * Check image upload limits
 */
exports.checkImageLimit = async (req, res, next) => {
  try {
    const subscription = await subscriptionService.getVendorSubscription(req.user.id);

    if (!subscription || subscription.status !== 'active') {
      return errorResponse(res, 'Active subscription required', 403);
    }

    const maxImages = subscription.features.maxImages;
    const uploadedImages = req.files?.length || 0;

    if (uploadedImages > maxImages) {
      return errorResponse(
        res,
        `Your plan allows up to ${maxImages} images per product. You uploaded ${uploadedImages}.`,
        403
      );
    }

    next();
  } catch (error) {
    console.error('Image limit check error:', error);
    return errorResponse(res, 'Failed to verify image limits', 500);
  }
};