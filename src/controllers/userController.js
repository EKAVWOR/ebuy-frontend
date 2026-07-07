// src/controllers/userController.js

const User = require('../models/User');
const uploadService = require('../services/uploadService');
const { successResponse, errorResponse } = require('../utils/responses');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    successResponse(res, {
      message: 'Profile retrieved successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    errorResponse(res, error.message || 'Failed to get profile', 500);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { fullname, phone, address } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    if (fullname) user.fullname = fullname;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    await user.save();

    successResponse(res, {
      message: 'Profile updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    errorResponse(res, error.message || 'Failed to update profile', 500);
  }
};

// @desc    Upload profile image
// @route   PUT /api/users/profile-image
// @access  Private
exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'No image file provided', 400);
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Delete old image if exists
    if (user.profileImage) {
      await uploadService.deleteImage(user.profileImage);
    }

    // Upload new image
    const uploadResult = await uploadService.uploadImage(req.file, 'profiles');
    user.profileImage = uploadResult.secure_url;

    await user.save();

    successResponse(res, {
      message: 'Profile image updated successfully',
      data: { profileImage: user.profileImage }
    });

  } catch (error) {
    console.error('Upload profile image error:', error);
    errorResponse(res, error.message || 'Failed to upload image', 500);
  }
};