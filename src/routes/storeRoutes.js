// src/routes/storeRoutes.js

const express = require('express');
const router = express.Router();
const {
  createStore,
  getMyStore,
  updateStore,
  getAllStores,
  getStore,
  getStoreProducts
} = require('../controllers/storeController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { requireActiveSubscription } = require('../middleware/subscriptionMiddleware'); // ✅ lowercase
const { validateStore } = require('../middleware/validationMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

// Public routes
router.get('/', getAllStores);
router.get('/:id', getStore);
router.get('/:id/products', getStoreProducts);

// Vendor routes - REQUIRE SUBSCRIPTION
router.post(
  '/', 
  protect, 
  authorize('vendor'), 
  requireActiveSubscription,
  validateStore, 
  createStore
);

router.get('/my/store', protect, authorize('vendor'), getMyStore);

router.put(
  '/:id', 
  protect, 
  authorize('vendor'), 
  requireActiveSubscription,
  updateStore
);

router.put(
  '/:id/logo', 
  protect, 
  authorize('vendor'),
  requireActiveSubscription,
  upload.single('logo'), 
  updateStore
);

router.put(
  '/:id/banner', 
  protect, 
  authorize('vendor'),
  requireActiveSubscription,
  upload.single('banner'), 
  updateStore
);

module.exports = router;