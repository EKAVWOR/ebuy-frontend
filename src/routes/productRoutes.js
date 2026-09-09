// src/routes/productRoutes.js

const express = require("express");
const router = express.Router();

const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getVendorProducts,
} = require("../controllers/productController");

const { protect, authorize, isProductOwner } = require("../middleware/authMiddleware");
const { validateProduct } = require("../middleware/validationMiddleware");
const { upload } = require("../middleware/uploadMiddleware");

// ==================== PUBLIC ROUTES ====================
router.get("/", getProducts);
router.get("/:id", getProduct);

// ==================== VENDOR ROUTES (NO SUBSCRIPTION) ====================
router.get("/vendor/my-products", protect, authorize("vendor"), getVendorProducts);

router.post(
  "/",
  protect,
  authorize("vendor"),
  upload.array("images", 10), // keep max 10 as a hard limit
  validateProduct,
  createProduct
);

router.put(
  "/:id",
  protect,
  authorize("vendor"),
  isProductOwner,
  upload.array("images", 10),
  updateProduct
);

router.delete("/:id", protect, authorize("vendor"), isProductOwner, deleteProduct);

module.exports = router;