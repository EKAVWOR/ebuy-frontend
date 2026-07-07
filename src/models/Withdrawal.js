// src/models/Withdrawal.js

const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1000 // Minimum withdrawal amount
  },
  bankDetails: {
    bankName: {
      type: String,
      required: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    accountName: {
      type: String,
      required: true
    },
    bankCode: String
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected', 'failed'],
    default: 'pending'
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: Date,
  transferReference: String,
  notes: String,
  rejectionReason: String
}, {
  timestamps: true
});

// Indexes
withdrawalSchema.index({ vendorId: 1, status: 1 });
withdrawalSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);