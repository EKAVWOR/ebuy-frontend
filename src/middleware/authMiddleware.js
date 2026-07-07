// src/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { errorResponse } = require('../utils/responses');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return errorResponse(res, 'Not authorized to access this route', 401);
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Check if user is suspended
      if (user.status === 'suspended') {
        return errorResponse(res, 'Account suspended. Contact admin.', 403);
      }

      // Attach user to request
      req.user = user;
      next();

    } catch (err) {
      return errorResponse(res, 'Invalid or expired token', 401);
    }

  } catch (error) {
    console.error('Auth middleware error:', error);
    return errorResponse(res, 'Authentication failed', 500);
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res,
        `User role '${req.user.role}' is not authorized to access this route`,
        403
      );
    }
    next();
  };
};

// Check if vendor owns the store
exports.isStoreOwner = async (req, res, next) => {
  try {
    const Store = require('../models/Store');
    const storeId = req.params.storeId || req.body.storeId;

    const store = await Store.findById(storeId);

    if (!store) {
      return errorResponse(res, 'Store not found', 404);
    }

    if (store.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return errorResponse(res, 'Not authorized to access this store', 403);
    }

    req.store = store;
    next();

  } catch (error) {
    console.error('Store owner check error:', error);
    return errorResponse(res, 'Authorization check failed', 500);
  }
};

// Check if vendor owns the product
exports.isProductOwner = async (req, res, next) => {
  try {
    const Product = require('../models/Product');
    const productId = req.params.productId || req.params.id;

    const product = await Product.findById(productId);

    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    if (product.vendorId.toString() !== req.user.id && req.user.role !== 'admin') {
      return errorResponse(res, 'Not authorized to access this product', 403);
    }

    req.product = product;
    next();

  } catch (error) {
    console.error('Product owner check error:', error);
    return errorResponse(res, 'Authorization check failed', 500);
  }
};