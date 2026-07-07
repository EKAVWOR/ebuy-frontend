// src/models/PlatformRevenue.js

const mongoose = require('mongoose');

const platformRevenueSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['commission', 'platform_fee', 'service_charge'],
    default: 'commission'
  },
  metadata: {
    buyerId: mongoose.Schema.Types.ObjectId,
    vendorId: mongoose.Schema.Types.ObjectId,
    sugCommission: Number
  }
}, {
  timestamps: true
});

// Indexes
platformRevenueSchema.index({ type: 1, createdAt: -1 });
platformRevenueSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PlatformRevenue', platformRevenueSchema);