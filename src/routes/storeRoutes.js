// src/routes/storeRoutes.js
const express = require("express");
const router = express.Router();

const {
  createStore,
  getMyStore,
  updateStore,
  getAllStores,
  getStore,
  getStoreProducts,
} = require("../controllers/storeController");

const { protect, authorize } = require("../middleware/authMiddleware");
const { validateStore } = require("../middleware/validationMiddleware");
const { upload } = require("../middleware/uploadMiddleware");

// ✅ Vendor routes FIRST (so /my/store doesn't get captured by /:id)
router.get("/my/store", protect, authorize("vendor"), getMyStore);

router.post("/", protect, authorize("vendor"), validateStore, createStore);

router.put("/:id", protect, authorize("vendor"), updateStore);

router.put("/:id/logo", protect, authorize("vendor"), upload.single("logo"), updateStore);

router.put("/:id/banner", protect, authorize("vendor"), upload.single("banner"), updateStore);

// Public routes
router.get("/", getAllStores);
router.get("/:id/products", getStoreProducts);
router.get("/:id", getStore);

module.exports = router;