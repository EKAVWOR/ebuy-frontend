// src/models/CommissionSetting.js

const mongoose = require('mongoose');

const commissionSettingSchema = new mongoose.Schema({
  vendorPercentage: {
    type: Number,
    required: true,
    default: 90,
    min: 0,
    max: 100
  },
  sugPercentage: {
    type: Number,
    required: true,
    default: 4,
    min: 0,
    max: 100
  },
  platformPercentage: {
    type: Number,
    required: true,
    default: 6,
    min: 0,
    max: 100
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Validate total percentage equals 100
commissionSettingSchema.pre('save', function(next) {
  const total = this.vendorPercentage + this.sugPercentage + this.platformPercentage;
  if (total !== 100) {
    next(new Error('Total commission percentages must equal 100%'));
  }
  next();
});

module.exports = mongoose.model('CommissionSetting', commissionSettingSchema);