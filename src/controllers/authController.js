// src/controllers/authController.js

const User = require('../models/User');
const StudentRegistry = require('../models/StudentRegistry');
const { generateToken } = require('../utils/generateToken');
const { successResponse, errorResponse } = require('../utils/responses');

// @desc    Register new user (student or vendor - BOTH must have matric)
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    console.log('📥 Register request body:', req.body);

    const { fullname, email, phone, password, role, matricNumber, businessName } = req.body;

    // ==================== BASIC VALIDATION ====================
    if (!fullname || !email || !phone || !password || !role) {
      return errorResponse(res, 'All fields required: fullname, email, phone, password, role', 400);
    }

    if (password.length < 6) {
      return errorResponse(res, 'Password must be at least 6 characters', 400);
    }

    // Validate role
    const allowedRoles = ['student', 'vendor'];
    if (!allowedRoles.includes(role)) {
      return errorResponse(res, 'Invalid role. Use student or vendor', 400);
    }

    // ==================== MATRIC NUMBER REQUIRED FOR BOTH ====================
    if (!matricNumber) {
      return errorResponse(res, 'Matric number is required for registration', 400);
    }

    const normalizedMatric = matricNumber.toUpperCase().trim();

    // ==================== CHECK DUPLICATE EMAIL ====================
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return errorResponse(res, 'Email already registered', 400);
    }

    // ==================== CHECK MATRIC IN REGISTRY ====================
    const studentRecord = await StudentRegistry.findOne({ matricNumber: normalizedMatric });
    if (!studentRecord) {
      return errorResponse(res, 'Matric number not found in student registry. Contact SUG.', 404);
    }

    if (studentRecord.status !== 'active') {
      return errorResponse(res, `Student record is ${studentRecord.status}, cannot register`, 400);
    }

    // ==================== CHECK MATRIC NOT ALREADY USED ====================
    const existingMatric = await User.findOne({ matricNumber: normalizedMatric });
    if (existingMatric) {
      return errorResponse(res, 'This matric number is already registered to another account', 400);
    }

    // ==================== BUILD USER DATA ====================
    const userData = {
      fullname: fullname.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password,
      role,
      matricNumber: normalizedMatric,
      department: studentRecord.department,
      faculty: studentRecord.faculty,
      level: studentRecord.level
    };

    // ==================== ROLE-SPECIFIC SETUP ====================
    if (role === 'student') {
      // Students auto-verified since they're in registry
      userData.verified = true;
      userData.status = 'active';
    } else if (role === 'vendor') {
      // Vendors need SUG approval before selling
      userData.verified = false;
      userData.status = 'pending';
      if (businessName) {
        userData.businessName = businessName.trim();
      }
    }

    // ==================== CREATE USER ====================
    const user = await User.create(userData);

    // Mark registry entry as registered
    studentRecord.isRegistered = true;
    await studentRecord.save();

    // ==================== RESPONSE ====================
    if (role === 'student') {
      // Students get token immediately
      const token = generateToken(user._id);

      return successResponse(res, {
        message: 'Student registration successful',
        data: {
          user: {
            id: user._id,
            fullname: user.fullname,
            email: user.email,
            role: user.role,
            matricNumber: user.matricNumber,
            verified: user.verified,
            status: user.status
          },
          token
        }
      }, 201);
    } else {
      // Vendors: NO TOKEN - must wait for approval
      return successResponse(res, {
        message: 'Vendor registration submitted! Awaiting SUG approval. You will be notified once approved.',
        data: {
          user: {
            id: user._id,
            fullname: user.fullname,
            email: user.email,
            role: user.role,
            matricNumber: user.matricNumber,
            verified: user.verified,
            status: user.status
          }
        }
      }, 201);
    }

  } catch (error) {
    console.error('❌ Registration error:', error);
    console.error('❌ Stack:', error.stack);

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return errorResponse(res, messages.join(', '), 400);
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return errorResponse(res, `${field} already exists`, 400);
    }

    errorResponse(res, error.message || 'Registration failed', 500);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Please provide email and password', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // ==================== STATUS CHECKS ====================
    if (user.status === 'suspended') {
      return errorResponse(res, 'Your account has been suspended. Contact admin.', 403);
    }

    // Vendors need SUG approval before login
    if (user.role === 'vendor' && (user.status === 'pending' || !user.verified)) {
      return errorResponse(
        res, 
        'Your vendor account is pending SUG approval. Please wait for confirmation.', 
        403
      );
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    successResponse(res, {
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          fullname: user.fullname,
          email: user.email,
          role: user.role,
          matricNumber: user.matricNumber,
          verified: user.verified,
          status: user.status
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    errorResponse(res, error.message || 'Login failed', 500);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    successResponse(res, {
      message: 'User profile retrieved',
      data: { user }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    errorResponse(res, error.message || 'Failed to get profile', 500);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
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

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return errorResponse(res, 'Please provide current and new password', 400);
    }

    if (newPassword.length < 6) {
      return errorResponse(res, 'New password must be at least 6 characters', 400);
    }

    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return errorResponse(res, 'Current password is incorrect', 401);
    }

    user.password = newPassword;
    await user.save();

    successResponse(res, {
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    errorResponse(res, error.message || 'Failed to change password', 500);
  }
};

// @desc    Verify matric number (pre-registration check)
// @route   POST /api/auth/verify-matric
// @access  Public
exports.verifyMatricNumber = async (req, res) => {
  try {
    console.log('📥 Verify matric body:', req.body);

    const { matricNumber } = req.body;

    if (!matricNumber) {
      return errorResponse(res, 'Matric number is required', 400);
    }

    const normalizedMatric = matricNumber.toUpperCase().trim();

    const studentRecord = await StudentRegistry.findOne({ 
      matricNumber: normalizedMatric
    });

    if (!studentRecord) {
      return errorResponse(res, 'Matric number not found in registry. Please contact SUG.', 404);
    }

    if (studentRecord.status !== 'active') {
      return errorResponse(res, `Student record is ${studentRecord.status}, cannot register`, 400);
    }

    // Check if already registered
    const existingUser = await User.findOne({ matricNumber: normalizedMatric });
    if (existingUser) {
      return errorResponse(res, 'This matric number is already registered', 400);
    }

    successResponse(res, {
      message: 'Matric number verified successfully',
      data: {
        student: {
          matricNumber: studentRecord.matricNumber,
          fullname: studentRecord.fullname,
          department: studentRecord.department,
          faculty: studentRecord.faculty,
          level: studentRecord.level
        }
      }
    });

  } catch (error) {
    console.error('Verify matric error:', error);
    errorResponse(res, error.message || 'Verification failed', 500);
  }
};