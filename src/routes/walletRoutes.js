// src/routes/walletRoutes.js

const express = require('express');
const router = express.Router();
const {
  getWallet,
  getWalletBalance,
  getWalletTransactions,
  updateBankDetails,
  requestWithdrawal,
  getWithdrawals
} = require('../controllers/walletController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All wallet routes require vendor authentication
router.use(protect);
router.use(authorize('vendor'));

router.get('/', getWallet);
router.get('/balance', getWalletBalance);
router.get('/transactions', getWalletTransactions);
router.put('/bank-details', updateBankDetails);
router.post('/withdraw', requestWithdrawal);
router.get('/withdrawals', getWithdrawals);

module.exports = router;