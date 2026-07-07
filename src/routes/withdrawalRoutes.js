// src/routes/withdrawalRoutes.js

const express = require('express');
const router = express.Router();
const {
  getAllWithdrawals,
  processWithdrawal,
  rejectWithdrawal
} = require('../controllers/withdrawalController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Admin only routes
router.use(protect);
router.use(authorize('admin'));

router.get('/', getAllWithdrawals);
router.put('/:id/process', processWithdrawal);
router.put('/:id/reject', rejectWithdrawal);

module.exports = router;