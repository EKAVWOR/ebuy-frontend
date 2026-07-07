// src/config/constants.js

module.exports = {
  // User roles
  USER_ROLES: {
    STUDENT: 'student',
    VENDOR: 'vendor',
    SUG: 'sug',
    ADMIN: 'admin'
  },

  // Order statuses
  ORDER_STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled'
  },

  // Payment statuses
  PAYMENT_STATUS: {
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded'
  },

  // Store statuses
  STORE_STATUS: {
    PENDING: 'pending',
    ACTIVE: 'active',
    SUSPENDED: 'suspended'
  },

  // Product categories
  PRODUCT_CATEGORIES: [
    'Fashion',
    'Electronics',
    'Books',
    'Food',
    'Services',
    'Others'
  ],

  // Commission defaults
  COMMISSION_DEFAULTS: {
    VENDOR: 90,
    SUG: 4,
    PLATFORM: 6
  },

  // Pagination
  DEFAULT_PAGE_SIZE: 12,
  MAX_PAGE_SIZE: 100,

  // File upload
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],

  // Withdrawal
  MIN_WITHDRAWAL_AMOUNT: 1000
};