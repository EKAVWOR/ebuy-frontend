// src/models/VendorWallet.js

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit', 'debit', 'pending', 'reversal'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  reference: {
    type: String,
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  description: {
    type: String,
    required: true
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const vendorWalletSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  pendingBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  totalEarnings: {
    type: Number,
    default: 0,
    min: 0
  },
  totalWithdrawals: {
    type: Number,
    default: 0,
    min: 0
  },
  transactions: [transactionSchema],
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String,
    bankCode: String
  }
}, {
  timestamps: true
});

// Method to add transaction
vendorWalletSchema.methods.addTransaction = function(transactionData) {
  this.transactions.unshift({
    ...transactionData,
    balanceBefore: this.balance
  });
  
  // Keep only last 100 transactions in document
  if (this.transactions.length > 100) {
    this.transactions = this.transactions.slice(0, 100);
  }
};

module.exports = mongoose.model('VendorWallet', vendorWalletSchema);