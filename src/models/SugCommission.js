// src/models/SugCommission.js

const mongoose = require('mongoose');

const sugCommissionSchema = new mongoose.Schema({
  sugId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  percentage: {
    type: Number,
    required: true
  },
  orderAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'paid'],
    default: 'confirmed'
  },
  paidAt: Date,
  metadata: {
    buyerId: mongoose.Schema.Types.ObjectId,
    vendorId: mongoose.Schema.Types.ObjectId
  }
}, {
  timestamps: true
});

// Indexes
sugCommissionSchema.index({ status: 1, createdAt: -1 });
sugCommissionSchema.index({ sugId: 1, createdAt: -1 });

module.exports = mongoose.model('SugCommission', sugCommissionSchema);