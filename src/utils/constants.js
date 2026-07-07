// src/utils/constants.js

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

  // Product statuses
  PRODUCT_STATUS: {
    DRAFT: 'draft',
    ACTIVE: 'active',
    OUT_OF_STOCK: 'out_of_stock',
    DISCONTINUED: 'discontinued'
  },

  // Product categories
  PRODUCT_CATEGORIES: [
    'Fashion',
    'Electronics',
    'Books',
    'Food',
    'Services',
    'Beauty & Health',
    'Sports',
    'Home & Kitchen',
    'Others'
  ],

  // Nigerian states
  NIGERIAN_STATES: [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
    'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo',
    'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna',
    'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
    'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers',
    'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
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
  MAX_PRODUCT_IMAGES: 5,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],

  // Withdrawal
  MIN_WITHDRAWAL_AMOUNT: 1000,

  // Platform fee
  PLATFORM_FEE_PERCENTAGE: 10
};