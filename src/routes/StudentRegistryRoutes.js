const express = require("express");
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
  searchStudent,
} = require("../controllers/studentRegistryController");

const { protect, authorize } = require("../middleware/authMiddleware");
const { uploadSpreadsheet } = require("../middleware/uploadMiddleware");

router.use(protect);
router.use(authorize("sug", "admin"));

router.get("/template", downloadTemplate);
router.get("/export", exportRegistry);
router.get("/statistics", getRegistryStatistics);
router.get("/search", searchStudent);

router.get("/", getStudentRegistry);
router.post("/", addStudent);
router.post("/upload", uploadSpreadsheet.single("file"), uploadStudentRegistry);
router.put("/bulk-update", bulkUpdateStatus);
router.put("/:id", updateStudent);
router.delete("/:id", deleteStudent);

module.exports = router;