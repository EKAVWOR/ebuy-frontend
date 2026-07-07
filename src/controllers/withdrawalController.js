// src/controllers/withdrawalController.js

const Withdrawal = require('../models/Withdrawal');
const walletService = require('../services/walletService');
const { successResponse, errorResponse } = require('../utils/responses');

// @desc    Get all withdrawal requests
// @route   GET /api/withdrawals
// @access  Private (Admin)
exports.getAllWithdrawals = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status } = req.query;

    let query = {};

    if (status) {
      query.status = status;
    }

    const withdrawals = await Withdrawal.find(query)
      .populate('vendorId', 'fullname email phone')
      .populate('processedBy', 'fullname')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Withdrawal.countDocuments(query);

    // Get statistics
    const stats = await Withdrawal.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const statistics = {
      pending: 0,
      processing: 0,
      completed: 0,
      rejected: 0,
      totalPending: 0,
      totalCompleted: 0
    };

    stats.forEach(stat => {
      statistics[stat._id] = stat.count;
      if (stat._id === 'pending') {
        statistics.totalPending = stat.totalAmount;
      } else if (stat._id === 'completed') {
        statistics.totalCompleted = stat.totalAmount;
      }
    });

    successResponse(res, {
      message: 'Withdrawals retrieved successfully',
      data: {
        withdrawals,
        statistics,
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

// @desc    Process withdrawal request
// @route   PUT /api/withdrawals/:id/process
// @access  Private (Admin)
exports.processWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { transferReference, notes } = req.body;

    const withdrawal = await Withdrawal.findById(id)
      .populate('vendorId', 'fullname email');

    if (!withdrawal) {
      return errorResponse(res, 'Withdrawal request not found', 404);
    }

    if (withdrawal.status !== 'pending') {
      return errorResponse(res, 'Withdrawal already processed', 400);
    }

    try {
      // Debit vendor wallet
      await walletService.debitWallet(
        withdrawal.vendorId._id,
        withdrawal.amount,
        withdrawal._id.toString(),
        `Withdrawal - ${transferReference || 'Bank Transfer'}`
      );

      // Update withdrawal status
      withdrawal.status = 'completed';
      withdrawal.processedBy = req.user.id;
      withdrawal.processedAt = new Date();
      withdrawal.transferReference = transferReference;
      withdrawal.notes = notes;
      await withdrawal.save();

      successResponse(res, {
        message: 'Withdrawal processed successfully',
        data: { withdrawal }
      });

    } catch (walletError) {
      console.error('Wallet debit error:', walletError);
      return errorResponse(res, walletError.message || 'Failed to debit wallet', 500);
    }

  } catch (error) {
    console.error('Process withdrawal error:', error);
    errorResponse(res, error.message || 'Failed to process withdrawal', 500);
  }
};

// @desc    Reject withdrawal request
// @route   PUT /api/withdrawals/:id/reject
// @access  Private (Admin)
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return errorResponse(res, 'Rejection reason is required', 400);
    }

    const withdrawal = await Withdrawal.findById(id);

    if (!withdrawal) {
      return errorResponse(res, 'Withdrawal request not found', 404);
    }

    if (withdrawal.status !== 'pending') {
      return errorResponse(res, 'Withdrawal already processed', 400);
    }

    withdrawal.status = 'rejected';
    withdrawal.processedBy = req.user.id;
    withdrawal.processedAt = new Date();
    withdrawal.rejectionReason = reason;
    await withdrawal.save();

    successResponse(res, {
      message: 'Withdrawal rejected successfully',
      data: { withdrawal }
    });

  } catch (error) {
    console.error('Reject withdrawal error:', error);
    errorResponse(res, error.message || 'Failed to reject withdrawal', 500);
  }
};