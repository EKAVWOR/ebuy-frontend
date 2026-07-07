// src/routes/studentRegistryRoutes.js (COMPLETE UPDATE)

const express = require('express');
const router = express.Router();
const {
  uploadStudentRegistry,
  getStudentRegistry,
  addStudent,
  updateStudent,
  deleteStudent,
  bulkUpdateStatus,
  downloadTemplate,
  exportRegistry,
  getRegistryStatistics,
  searchStudent
} = require('../controllers/studentRegistryController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

// All routes require SUG or Admin authentication
router.use(protect);
router.use(authorize('sug', 'admin'));

// Template and export routes
router.get('/template', downloadTemplate);
router.get('/export', exportRegistry);
router.get('/statistics', getRegistryStatistics);
router.get('/search', searchStudent);

// CRUD routes
router.get('/', getStudentRegistry);
router.post('/', addStudent);
router.post('/upload', upload.single('file'), uploadStudentRegistry);
router.put('/bulk-update', bulkUpdateStatus);
router.put('/:id', updateStudent);
router.delete('/:id', deleteStudent);

module.exports = router;