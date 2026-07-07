// src/models/Order.js

const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    index: true
    // ❌ Removed: required: true (it's auto-generated)
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true
    },
    productName: {
      type: String,
      required: true
    },
    productImage: String,
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    subtotal: {
      type: Number,
      required: true
    }
  }],
  subtotal: {
    type: Number,
    required: true
  },
  platformFee: {
    type: Number,
    required: true,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentReference: {
    type: String,
    unique: true,
    sparse: true
  },
  // Add these fields to the Order schema
shippedAt: {
  type: Date,
  default: null
},
deliveredAt: {
  type: Date,
  default: null
},
  shippingAddress: {
    fullname: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, default: 'Nigeria' }
  },
  notes: String,
  statusHistory: [{
    status: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    note: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// ✅ FIXED - Use pre('validate') to generate BEFORE validation runs
orderSchema.pre('validate', async function(next) {
  if (this.isNew && !this.orderNumber) {
    try {
      // Use timestamp + random string for uniqueness (avoids race conditions)
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      this.orderNumber = `ORD-${timestamp}-${random}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Indexes
orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ 'items.vendorId': 1 });
orderSchema.index({ orderStatus: 1, paymentStatus: 1 });

module.exports = mongoose.model('Order', orderSchema);