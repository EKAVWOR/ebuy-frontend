// src/models/Subscription.js

const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    default: null
  },
  plan: {
    type: String,
    enum: ['basic', 'standard', 'premium'],
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentReference: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  paystackReference: {
    type: String,
    unique: true,
    sparse: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'pending'],
    default: 'pending',
    index: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
    index: true
  },
  autoRenew: {
    type: Boolean,
    default: false
  },
  features: {
    maxProducts: {
      type: Number,
      required: true
    },
    maxImages: {
      type: Number,
      required: true
    },
    analytics: {
      type: Boolean,
      default: false
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    featuredStore: {
      type: Boolean,
      default: false
    }
  },
  renewalHistory: [{
    renewedAt: {
      type: Date,
      default: Date.now
    },
    previousExpiryDate: Date,
    newExpiryDate: Date,
    amount: Number,
    paymentReference: String
  }]
}, {
  timestamps: true
});

// Virtual to check if subscription is active and not expired
subscriptionSchema.virtual('isActive').get(function() {
  return this.status === 'active' && this.expiryDate > new Date();
});

// Method to check if subscription is expired
subscriptionSchema.methods.isExpired = function() {
  return new Date() > this.expiryDate;
};

// Method to renew subscription
subscriptionSchema.methods.renew = function(paymentReference) {
  const oldExpiryDate = this.expiryDate;
  const newExpiryDate = new Date();
  
  // If renewing before expiry, extend from current expiry date
  if (this.expiryDate > new Date()) {
    newExpiryDate.setTime(this.expiryDate.getTime());
  }
  
  // Add 30 days
  newExpiryDate.setDate(newExpiryDate.getDate() + 30);
  
  this.renewalHistory.push({
    renewedAt: new Date(),
    previousExpiryDate: oldExpiryDate,
    newExpiryDate: newExpiryDate,
    amount: this.amount,
    paymentReference
  });
  
  this.expiryDate = newExpiryDate;
  this.status = 'active';
  this.paymentStatus = 'paid';
  this.paymentReference = paymentReference;
  
  return this.save();
};

// Static method to get plan details
subscriptionSchema.statics.getPlanDetails = function(planName) {
  const plans = {
    basic: {
      name: 'Basic',
      price: 100,
      maxProducts: 50,
      maxImages: 3,
      analytics: false,
      prioritySupport: false,
      featuredStore: false,
      features: [
        'Up to 50 products',
        'Up to 3 images per product',
        'Basic store analytics',
        'Email support'
      ]
    },
    standard: {
      name: 'Standard',
      price: 2500,
      maxProducts: 200,
      maxImages: 5,
      analytics: true,
      prioritySupport: false,
      featuredStore: false,
      features: [
        'Up to 200 products',
        'Up to 5 images per product',
        'Advanced analytics',
        'Priority email support',
        'Store customization'
      ]
    },
    premium: {
      name: 'Premium',
      price: 5000,
      maxProducts: -1, // Unlimited
      maxImages: 10,
      analytics: true,
      prioritySupport: true,
      featuredStore: true,
      features: [
        'Unlimited products',
        'Up to 10 images per product',
        'Advanced analytics & reports',
        'Priority support (24/7)',
        'Featured store placement',
        'Custom branding',
        'API access'
      ]
    }
  };
  
  return plans[planName] || null;
};

// Index for efficient queries
subscriptionSchema.index({ vendorId: 1, status: 1 });
subscriptionSchema.index({ expiryDate: 1, status: 1 });

// Auto-expire subscriptions (run daily via cron job)
subscriptionSchema.statics.expireSubscriptions = async function() {
  const now = new Date();
  const result = await this.updateMany(
    {
      status: 'active',
      expiryDate: { $lt: now }
    },
    {
      $set: { status: 'expired' }
    }
  );
  return result;
};

module.exports = mongoose.model('Subscription', subscriptionSchema);