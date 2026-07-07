// src/models/Payment.js

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentGateway: {
    type: String,
    default: 'paystack'
  },
  paymentReference: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  paystackReference: {
    type: String,
    unique: true,
    sparse: true
  },
  authorizationUrl: String,
  accessCode: String,
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'abandoned'],
    default: 'pending'
  },
  paidAt: Date,
  channel: String, // card, bank, ussd, etc.
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  paystackResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for queries
paymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);