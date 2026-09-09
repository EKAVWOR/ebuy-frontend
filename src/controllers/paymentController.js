// src/controllers/paymentController.js

const paymentService = require("../services/paymentService");
const commissionService = require("../services/commissionService"); // ✅ correct casing/path
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const { successResponse, errorResponse } = require("../utils/responses");

// @desc    Initialize payment
// @route   POST /api/payments/initialize
// @access  Private (Student)
exports.initializePayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return errorResponse(res, "Order not found", 404);

    if (order.buyerId.toString() !== req.user.id) {
      return errorResponse(res, "Unauthorized access to this order", 403);
    }

    if (order.paymentStatus === "paid") {
      return errorResponse(res, "Order already paid", 400);
    }

    // ✅ Paystack amount is based on order.totalAmount
    // (Once you set platformFee=0 in orderService, buyer pays only subtotal)
    const paymentData = await paymentService.initializePayment(order, req.user);

    return successResponse(res, {
      message: "Payment initialized successfully",
      data: {
        authorizationUrl: paymentData.authorizationUrl,
        reference: paymentData.reference,
        accessCode: paymentData.accessCode,
      },
    });
  } catch (error) {
    console.error("Initialize payment error:", error);
    return errorResponse(res, error.message || "Payment initialization failed", 500);
  }
};

// @desc    Verify payment
// @route   GET /api/payments/verify/:reference
// @access  Private
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    const result = await paymentService.verifyPayment(reference);
    let { payment, order, alreadyVerified } = result;

    // ✅ paymentService.verifyPayment(reference) may return no "order" when alreadyVerified
    if (!order && payment?.orderId) {
      order = await Order.findById(payment.orderId);
    }

    // ✅ Only process commissions once (NO walletService.creditVendorsForOrder here)
    if (!alreadyVerified && order) {
      await commissionService.processCommissions(order);
    }

    return successResponse(res, {
      message: alreadyVerified ? "Payment already verified" : "Payment verified successfully",
      data: { payment, order, alreadyVerified },
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    return errorResponse(res, error.message || "Payment verification failed", 500);
  }
};

// @desc    Paystack webhook handler
// @route   POST /api/payments/webhook
// @access  Public (Paystack only)
exports.paystackWebhook = async (req, res) => {
  try {
    const crypto = require("crypto");
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return errorResponse(res, "Invalid webhook signature", 401);
    }

    const event = req.body;

    if (event.event === "charge.success") {
      const { reference, status } = event.data;

      if (status === "success") {
        // NOTE: you stored paystackReference as the paystack reference (response.data.data.reference)
        const payment = await Payment.findOne({ paystackReference: reference });

        if (payment && payment.status !== "success") {
          payment.status = "success";
          payment.paidAt = new Date(event.data.paid_at);
          payment.channel = event.data.channel;
          payment.paystackResponse = event.data;
          await payment.save();

          const order = await Order.findById(payment.orderId);
          if (order) {
            order.paymentStatus = "paid";
            order.orderStatus = "processing";
            await order.save();

            // ✅ Process commissions only (no double-credit)
            await commissionService.processCommissions(order);
          }
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
};

// @desc    Get payment by reference
// @route   GET /api/payments/:reference
// @access  Private
exports.getPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    const payment = await Payment.findOne({ paymentReference: reference })
      .populate("orderId")
      .populate("buyerId", "fullname email phone");

    if (!payment) return errorResponse(res, "Payment not found", 404);

    if (payment.buyerId._id.toString() !== req.user.id && req.user.role !== "admin") {
      return errorResponse(res, "Unauthorized access", 403);
    }

    return successResponse(res, {
      message: "Payment retrieved successfully",
      data: { payment },
    });
  } catch (error) {
    console.error("Get payment error:", error);
    return errorResponse(res, error.message || "Failed to get payment", 500);
  }
};

// @desc    Get user payments
// @route   GET /api/payments/my-payments
// @access  Private
exports.getMyPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const payments = await Payment.find({ buyerId: req.user.id })
      .populate("orderId", "orderNumber totalAmount orderStatus")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Payment.countDocuments({ buyerId: req.user.id });

    return successResponse(res, {
      message: "Payments retrieved successfully",
      data: {
        payments,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("Get payments error:", error);
    return errorResponse(res, error.message || "Failed to get payments", 500);
  }
};

// @desc    Get all payments (Admin)
// @route   GET /api/payments/admin/all
// @access  Private (Admin)
exports.getAllPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const { status, startDate, endDate } = req.query;

    const query = {};
    if (status) query.status = status;
    if (startDate && endDate) {
      query.paidAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const payments = await Payment.find(query)
      .populate("buyerId", "fullname email")
      .populate("orderId", "orderNumber totalAmount")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Payment.countDocuments(query);

    const stats = await Payment.aggregate([
      { $match: { status: "success" } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalTransactions: { $sum: 1 },
        },
      },
    ]);

    return successResponse(res, {
      message: "Payments retrieved successfully",
      data: {
        payments,
        statistics: stats[0] || { totalAmount: 0, totalTransactions: 0 },
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("Get all payments error:", error);
    return errorResponse(res, error.message || "Failed to get payments", 500);
  }
};