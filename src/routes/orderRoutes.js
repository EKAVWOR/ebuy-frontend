// src/routes/orderRoutes.js

const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrder,
  getOrderDetails,        // ✅ NEW
  getVendorOrders,
  updateOrderStatus,
  confirmDelivery,        // ✅ NEW
  cancelOrder,
  getOrderStatistics,
  getAllOrders
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validateOrder } = require('../middleware/validationMiddleware');

// Protected routes
router.use(protect);

// Student routes
router.post('/', authorize('student'), validateOrder, createOrder);
router.get('/my-orders', authorize('student'), getMyOrders);
router.put('/:id/confirm-delivery', authorize('student'), confirmDelivery); // ✅ NEW

// Vendor routes
router.get('/vendor/my-orders', authorize('vendor'), getVendorOrders);
router.get('/statistics', authorize('vendor', 'admin'), getOrderStatistics);

// Admin routes (place BEFORE /:id routes to avoid conflicts)
router.get('/admin/all', authorize('admin'), getAllOrders);

// Shared routes - IMPORTANT: /details must come BEFORE /:id
router.get('/:id/details', getOrderDetails);  // ✅ NEW - full details
router.get('/:id', getOrder);
router.put('/:id/status', authorize('vendor', 'admin'), updateOrderStatus);
router.put('/:id/cancel', cancelOrder);

module.exports = router;