// src/models/Store.js (UPDATED - Add subscription field)

const mongoose = require('mongoose');
const slugify = require('slugify');

const storeSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  storeName: {
    type: String,
    required: [true, 'Store name is required'],
    unique: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  logo: {
    type: String,
    default: null
  },
  banner: {
    type: String,
    default: null
  },
  description: {
    type: String,
    required: [true, 'Store description is required'],
    maxlength: 1000
  },
  category: {
    type: String,
    required: true,
    enum: ['Fashion', 'Electronics', 'Books', 'Food', 'Services', 'Others']
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'subscription_expired'],
    default: 'pending'
  },
  contactEmail: String,
  contactPhone: String,
  socialMedia: {
    instagram: String,
    twitter: String,
    facebook: String
  },
  metrics: {
    totalProducts: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    rating: { type: Number, default: 0 }
  },
  
  // NEW: Subscription reference
  currentSubscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    default: null
  }
}, {
  timestamps: true
});

// Generate slug before saving
storeSchema.pre('save', function(next) {
  if (this.isModified('storeName')) {
    this.slug = slugify(this.storeName, { lower: true, strict: true });
  }
  next();
});

// NEW: Virtual to check if subscription is valid
storeSchema.virtual('hasActiveSubscription').get(function() {
  return this.status === 'active' && this.currentSubscription;
});

// Index for faster queries
storeSchema.index({ slug: 1 });
storeSchema.index({ owner: 1 });
storeSchema.index({ status: 1, isApproved: 1 });

module.exports = mongoose.model('Store', storeSchema);