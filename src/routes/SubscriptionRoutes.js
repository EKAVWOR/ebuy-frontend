// src/routes/subscriptionRoutes.js

const express = require('express');
const router = express.Router();
const {
  getPlans,
  initializeSubscription,
  verifySubscription,
  getMySubscription,
  getSubscriptionHistory,
  renewSubscription,
  getAllSubscriptions,
  getSubscriptionStats
} = require('../controllers/SubscriptionController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes
router.get('/plans', getPlans);

// Vendor routes
router.use(protect);
router.use(authorize('vendor', 'admin'));

router.post('/initialize', initializeSubscription);
router.get('/verify/:reference', verifySubscription);
router.get('/my-subscription', getMySubscription);
router.get('/history', getSubscriptionHistory);
router.post('/renew', renewSubscription);

// Admin routes
router.get('/admin/all', authorize('admin'), getAllSubscriptions);
router.get('/admin/stats', authorize('admin'), getSubscriptionStats);

module.exports = router;