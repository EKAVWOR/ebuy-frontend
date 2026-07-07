// src/routes/adminRoutes.js

const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  getAllStores,
  updateStoreStatus,
  getCommissionSettings,
  updateCommissionSettings,
  getPlatformRevenue,
  getAnalytics
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All admin routes require admin authentication
router.use(protect);
router.use(authorize('admin'));

router.get('/dashboard', getDashboardStats);
router.get('/analytics', getAnalytics);

// User management
router.get('/users', getAllUsers);
router.put('/users/:userId/status', updateUserStatus);

// Store management
router.get('/stores', getAllStores);
router.put('/stores/:storeId/status', updateStoreStatus);

// Commission management
router.get('/commission-settings', getCommissionSettings);
router.put('/commission-settings', updateCommissionSettings);

// Revenue
router.get('/revenue', getPlatformRevenue);

module.exports = router;