// src/routes/productRoutes.js (UPDATED)

const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getVendorProducts
} = require('../controllers/productController');
const { protect, authorize, isProductOwner } = require('../middleware/authMiddleware');
const { checkProductLimit, checkImageLimit } = require('../middleware/SubscriptionMiddleware');
const { validateProduct } = require('../middleware/validationMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

// Public routes
router.get('/', getProducts);
router.get('/:id', getProduct);

// Vendor routes - ADD SUBSCRIPTION CHECKS
router.post(
  '/', 
  protect, 
  authorize('vendor'), 
  upload.array('images', 10),  // Max 10 but will be limited by subscription
  checkImageLimit,  // NEW - Check image limits based on plan
  checkProductLimit,  // NEW - Check product count limits
  validateProduct, 
  createProduct
);

router.get('/vendor/my-products', protect, authorize('vendor'), getVendorProducts);

router.put(
  '/:id', 
  protect, 
  authorize('vendor'), 
  isProductOwner, 
  upload.array('images', 10),
  checkImageLimit,  // NEW
  updateProduct
);

router.delete('/:id', protect, authorize('vendor'), isProductOwner, deleteProduct);

module.exports = router;