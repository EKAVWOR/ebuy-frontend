// src/middleware/uploadMiddleware.js

const multer = require('multer');
const path = require('path');
const { errorResponse } = require('../utils/responses');

// Memory storage - files stored as Buffer (good for Excel/image processing)
const storage = multer.memoryStorage();

// ==================== FILE FILTERS ====================

// Image only filter (for products, store logos, banners)
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Excel/CSV filter (for bulk uploads like student registry)
const spreadsheetFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv', // .csv
    'application/csv',
    'application/vnd.ms-excel.sheet.macroenabled.12' // .xlsm
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.xlsx', '.xls', '.csv'];

  if (allowedMimeTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel (.xlsx, .xls) or CSV files are allowed'), false);
  }
};

// Combined filter (accepts images AND spreadsheets)
const anyFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.xlsx', '.xls', '.csv', '.png', '.jpg', '.jpeg', '.gif', '.webp'];

  if (file.mimetype.startsWith('image/') || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

// ==================== UPLOAD CONFIGURATIONS ====================

// Default upload (for images - backward compatible)
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: imageFilter
});

// Image-only upload
const uploadImage = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: imageFilter
});

// Excel/CSV upload
const uploadSpreadsheet = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB for bulk data
  },
  fileFilter: spreadsheetFilter
});

// Any file upload (images + spreadsheets)
const uploadAny = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: anyFileFilter
});

// ==================== ERROR HANDLER ====================

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(res, 'File too large. Maximum size exceeded.', 400);
    }
    return errorResponse(res, err.message, 400);
  } else if (err) {
    return errorResponse(res, err.message, 400);
  }
  next();
};

module.exports = {
  upload,               // Default (images) - backward compatible
  uploadImage,          // Images only
  uploadSpreadsheet,    // Excel/CSV only
  uploadAny,            // Any file type
  handleMulterError
};