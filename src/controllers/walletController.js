// src/controllers/walletController.js

const walletService = require('../services/walletService');
const Withdrawal = require('../models/Withdrawal');
const { successResponse, errorResponse } = require('../utils/responses');

// @desc    Get vendor wallet
// @route   GET /api/wallet
// @access  Private (Vendor)
exports.getWallet = async (req, res) => {
  try {
    const wallet = await walletService.getOrCreateWallet(req.user.id, req.query.storeId);

    successResponse(res, {
      message: 'Wallet retrieved successfully',
      data: { wallet }
    });

  } catch (error) {
    console.error('Get wallet error:', error);
    errorResponse(res, error.message || 'Failed to get wallet', 500);
  }
};

// @desc    Get wallet balance
// @route   GET /api/wallet/balance
// @access  Private (Vendor)
exports.getWalletBalance = async (req, res) => {
  try {
    const balance = await walletService.getWalletBalance(req.user.id);

    successResponse(res, {
      message: 'Balance retrieved successfully',
      data: balance
    });

  } catch (error) {
    console.error('Get balance error:', error);
    errorResponse(res, error.message || 'Failed to get balance', 500);
  }
};

// @desc    Get wallet transactions
// @route   GET /api/wallet/transactions
// @access  Private (Vendor)
exports.getWalletTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const { transactions, total } = await walletService.getWalletTransactions(
      req.user.id,
      page,
      limit
    );

    successResponse(res, {
      message: 'Transactions retrieved successfully',
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    errorResponse(res, error.message || 'Failed to get transactions', 500);
  }
};

// @desc    Update bank details
// @route   PUT /api/wallet/bank-details
// @access  Private (Vendor)
exports.updateBankDetails = async (req, res) => {
  try {
    const { bankName, accountNumber, accountName, bankCode } = req.body;

    const VendorWallet = require('../models/VendorWallet');
    const wallet = await VendorWallet.findOne({ vendorId: req.user.id });

    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404);
    }

    wallet.bankDetails = {
      bankName,
      accountNumber,
      accountName,
      bankCode
    };

    await wallet.save();

    successResponse(res, {
      message: 'Bank details updated successfully',
      data: { bankDetails: wallet.bankDetails }
    });

  } catch (error) {
    console.error('Update bank details error:', error);
    errorResponse(res, error.message || 'Failed to update bank details', 500);
  }
};

// @desc    Request withdrawal
// @route   POST /api/wallet/withdraw
// @access  Private (Vendor)
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, bankDetails } = req.body;

    // Validate amount
    if (!amount || amount < 1000) {
      return errorResponse(res, 'Minimum withdrawal amount is ₦1,000', 400);
    }

    // Get wallet balance
    const balance = await walletService.getWalletBalance(req.user.id);

    if (balance.balance < amount) {
      return errorResponse(res, 'Insufficient wallet balance', 400);
    }

    // Create withdrawal request
    const withdrawal = await Withdrawal.create({
      vendorId: req.user.id,
      amount,
      bankDetails,
      status: 'pending'
    });

    successResponse(res, {
      message: 'Withdrawal request submitted successfully',
      data: { withdrawal }
    }, 201);

  } catch (error) {
    console.error('Request withdrawal error:', error);
    errorResponse(res, error.message || 'Failed to request withdrawal', 500);
  }
};

// @desc    Get vendor withdrawals
// @route   GET /api/wallet/withdrawals
// @access  Private (Vendor)
exports.getWithdrawals = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const withdrawals = await Withdrawal.find({ vendorId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Withdrawal.countDocuments({ vendorId: req.user.id });

    successResponse(res, {
      message: 'Withdrawals retrieved successfully',
      data: {
        withdrawals,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get withdrawals error:', error);
    errorResponse(res, error.message || 'Failed to get withdrawals', 500);
  }
};