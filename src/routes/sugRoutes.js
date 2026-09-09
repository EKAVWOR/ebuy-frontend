// src/routes/sugRoutes.js

const express = require('express');
const router = express.Router();

const {
  getDashboardStats,
  getUsers,
  getPendingVendors,
  approveVendor,
  verifyStudent,
  getAllStores,
  getPendingStores,
  getStoreDetails,
  approveStore,
  updateStoreStatus,
  getCommissionEarnings,
  getTransactionReports
} = require('../controllers/sugController');

const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('sug'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// User Management
router.get('/users', getUsers);
router.get('/pending-vendors', getPendingVendors);
router.put('/verify-student/:userId', verifyStudent);
router.put('/approve-vendor/:userId', approveVendor);

// Store Management
router.get('/stores', getAllStores);
router.get('/pending-stores', getPendingStores);
router.get('/stores/:storeId', getStoreDetails);
router.put('/stores/:storeId/approve', approveStore);
router.put('/stores/:storeId/status', updateStoreStatus);

// Reports
router.get('/commission-earnings', getCommissionEarnings);
router.get('/transaction-reports', getTransactionReports);

// ✅ Student registry is now handled by studentRegistryRoutes.js
// Mounted at /api/sug/student-registry

module.exports = router;