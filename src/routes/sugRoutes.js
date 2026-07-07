// src/routes/sugRoutes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const {
  // Dashboard
  getDashboardStats,
  
  // User Management
  getUsers,
  getPendingVendors,
  approveVendor,
  verifyStudent,
  
  // Store Management ✅ NEW
  getAllStores,
  getPendingStores,
  getStoreDetails,
  approveStore,
  updateStoreStatus,
  
  // Reports
  getCommissionEarnings,
  getTransactionReports,
  
  // Student Registry
  getStudentRegistry,
  addStudentToRegistry,
  bulkAddStudents,
  getStudentRecord,
  updateStudentRecord,
  deleteStudentRecord,
  getRegistryStats
} = require('../controllers/sugController');

const { protect, authorize } = require('../middleware/authMiddleware');

const upload = multer({
  dest: 'uploads/csv/',
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') return cb(new Error('Only CSV files allowed'));
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.use(protect);
router.use(authorize('sug'));

// ==================== DASHBOARD ====================
router.get('/dashboard', getDashboardStats);

// ==================== USER MANAGEMENT ====================
router.get('/users', getUsers);
router.get('/pending-vendors', getPendingVendors);
router.put('/verify-student/:userId', verifyStudent);
router.put('/approve-vendor/:userId', approveVendor);

// ==================== STORE MANAGEMENT ✅ NEW ====================
router.get('/stores', getAllStores);
router.get('/pending-stores', getPendingStores);
router.get('/stores/:storeId', getStoreDetails);
router.put('/stores/:storeId/approve', approveStore);
router.put('/stores/:storeId/status', updateStoreStatus);

// ==================== STUDENT REGISTRY ====================
router.get('/student-registry', getStudentRegistry);
router.post('/student-registry', addStudentToRegistry);
router.post('/student-registry/bulk', upload.single('file'), bulkAddStudents);
router.get('/student-registry/stats', getRegistryStats);
router.get('/student-registry/:id', getStudentRecord);
router.put('/student-registry/:id', updateStudentRecord);
router.delete('/student-registry/:id', deleteStudentRecord);

// ==================== REPORTS ====================
router.get('/commission-earnings', getCommissionEarnings);
router.get('/transaction-reports', getTransactionReports);

module.exports = router;