// src/routes/paymentRoutes.js

const express = require('express');
const router = express.Router();
const {
  initializePayment,
  verifyPayment,
  paystackWebhook,
  getPayment,
  getMyPayments,
  getAllPayments
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Webhook (no auth required - verified by signature)
router.post('/webhook', paystackWebhook);

// Protected routes
router.use(protect);

router.post('/initialize', authorize('student'), initializePayment);
router.get('/verify/:reference', verifyPayment);
router.get('/my-payments', getMyPayments);
router.get('/:reference', getPayment);

// Admin routes
router.get('/admin/all', authorize('admin'), getAllPayments);

module.exports = router;