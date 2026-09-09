// src/routes/sugRoutes.js
const express = require("express");
const router = express.Router();

const sugController = require("../controllers/sugController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.use(protect);
router.use(authorize("sug"));

// helper: ensure handler exists
const mustBeFn = (name) => {
  const fn = sugController[name];
  if (typeof fn !== "function") {
    throw new Error(`sugController.${name} is undefined. Check exports in src/controllers/sugController.js`);
  }
  return fn;
};

// Dashboard
router.get("/dashboard", mustBeFn("getDashboardStats"));

// User Management
router.get("/users", mustBeFn("getUsers"));
router.get("/pending-vendors", mustBeFn("getPendingVendors"));
router.put("/verify-student/:userId", mustBeFn("verifyStudent"));
router.put("/approve-vendor/:userId", mustBeFn("approveVendor"));

// Store Management
router.get("/stores", mustBeFn("getAllStores"));
router.get("/pending-stores", mustBeFn("getPendingStores"));
router.get("/stores/:storeId", mustBeFn("getStoreDetails"));
router.put("/stores/:storeId/approve", mustBeFn("approveStore"));
router.put("/stores/:storeId/status", mustBeFn("updateStoreStatus"));

// Reports
router.get("/commission-earnings", mustBeFn("getCommissionEarnings"));
router.get("/transaction-reports", mustBeFn("getTransactionReports"));

module.exports = router;