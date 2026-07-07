// src/models/Product.js

const mongoose = require('mongoose');
const slugify = require('slugify');

const productSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
  },
  subCategory: {
    type: String,
    default: null
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: 0
  },
  comparePrice: {
    type: Number,
    default: null
  },
  costPrice: {
    type: Number,
    default: null
  },
  images: [{
    type: String
  }],
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  sku: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true
  },
  tags: [String],
  status: {
    type: String,
    enum: ['draft', 'active', 'out_of_stock', 'discontinued'],
    default: 'active'
  },
  specifications: [{
    key: String,
    value: String
  }],
  metrics: {
    views: { type: Number, default: 0 },
    sales: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// ✅ NEW - Auto-generate SKU if empty/missing (runs BEFORE validation)
productSchema.pre('validate', function(next) {
  if (!this.sku || this.sku.trim() === '') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.sku = `PROD-${timestamp}-${random}`;
  }
  next();
});

// Generate slug before saving
productSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = slugify(`${this.name}-${Date.now()}`, { lower: true, strict: true });
  }
  next();
});

// Auto-update stock status
productSchema.pre('save', function(next) {
  if (this.stock === 0) {
    this.status = 'out_of_stock';
  }
  next();
});

// Indexes
productSchema.index({ storeId: 1 });
productSchema.index({ vendorId: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);