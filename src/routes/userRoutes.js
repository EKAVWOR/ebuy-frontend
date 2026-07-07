// src/routes/userRoutes.js (COMPLETE VERSION)

const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  uploadProfileImage
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

// All user routes require authentication
router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/profile-image', upload.single('image'), uploadProfileImage);

module.exports = router;