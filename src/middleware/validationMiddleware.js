// src/middleware/validationMiddleware.js

const { body, validationResult } = require('express-validator');
const { errorResponse } = require('../utils/responses');

// Handle validation errors
exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.param,
      message: err.msg
    }));
    return errorResponse(res, 'Validation failed', 400, errorMessages);
  }
  next();
};

// Registration validation
exports.validateRegistration = [
  body('fullname')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 3 })
    .withMessage('Full name must be at least 3 characters'),
  
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[0-9]{11}$/)
    .withMessage('Please provide a valid 11-digit phone number'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['student', 'vendor'])
    .withMessage('Role must be either student or vendor'),
  
  body('matricNumber')
    .if(body('role').equals('student'))
    .notEmpty()
    .withMessage('Matric number is required for students')
    .matches(/^[A-Z0-9\/]+$/)
    .withMessage('Invalid matric number format'),

  exports.handleValidationErrors
];

// Login validation
exports.validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  exports.handleValidationErrors
];

// Store creation validation
exports.validateStore = [
  body('storeName')
    .trim()
    .notEmpty()
    .withMessage('Store name is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Store name must be between 3 and 50 characters'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Store description is required')
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(['Fashion', 'Electronics', 'Books', 'Food', 'Services', 'Others'])
    .withMessage('Invalid category'),

  exports.handleValidationErrors
];

// Product creation validation
exports.validateProduct = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Product name must be between 3 and 100 characters'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required'),
  
  body('category')
    .notEmpty()
    .withMessage('Category is required'),
  
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  body('stock')
    .notEmpty()
    .withMessage('Stock is required')
    .isInt({ min: 0 })
    .withMessage('Stock must be a positive integer'),

  exports.handleValidationErrors
];

// ✅ FIXED - Order creation validation (items removed since backend builds from cart)
exports.validateOrder = [
  body('shippingAddress')
    .notEmpty()
    .withMessage('Shipping address is required')
    .isObject()
    .withMessage('Shipping address must be an object'),

  body('shippingAddress.fullname')
    .trim()
    .notEmpty()
    .withMessage('Recipient name is required'),
  
  body('shippingAddress.phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required'),
  
  body('shippingAddress.address')
    .trim()
    .notEmpty()
    .withMessage('Address is required'),
  
  body('shippingAddress.city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),
  
  body('shippingAddress.state')
    .trim()
    .notEmpty()
    .withMessage('State is required'),

  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string'),

  exports.handleValidationErrors
];