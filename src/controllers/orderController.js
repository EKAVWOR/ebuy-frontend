// src/controllers/orderController.js

const orderService = require('../services/orderService');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const { successResponse, errorResponse } = require('../utils/responses');

// @desc    Create order from cart
// @route   POST /api/orders
// @access  Private (Student)
exports.createOrder = async (req, res) => {
  try {
    const { shippingAddress, notes } = req.body;

    // ✅ Check if cart has items BEFORE creating order
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart || !cart.items || cart.items.length === 0) {
      return errorResponse(res, 'Your cart is empty. Add items before checking out.', 400);
    }

    const order = await orderService.createOrderFromCart(
      req.user.id,
      shippingAddress,
      notes
    );

    successResponse(res, {
      message: 'Order created successfully',
      data: { order }
    }, 201);

  } catch (error) {
    console.error('Create order error:', error);
    errorResponse(res, error.message || 'Failed to create order', 500);
  }
};

// @desc    Get user orders (list)
// @route   GET /api/orders/my-orders
// @access  Private (Student)
exports.getMyOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status } = req.query;

    let query = { buyerId: req.user.id };

    if (status) {
      query.orderStatus = status;
    }

    const orders = await Order.find(query)
      .populate('items.productId', 'name images')
      .populate('items.storeId', 'storeName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Order.countDocuments(query);

    successResponse(res, {
      message: 'Orders retrieved successfully',
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get orders error:', error);
    errorResponse(res, error.message || 'Failed to get orders', 500);
  }
};

// @desc    Get single order (basic info)
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res) => {
  try {
    const order = await orderService.getOrderDetails(req.params.id);

    if (!order) {
      return errorResponse(res, 'Order not found', 404);
    }

    // Check authorization
    const isAuthorized =
      order.buyerId._id.toString() === req.user.id ||
      order.items.some(item => item.vendorId._id.toString() === req.user.id) ||
      ['admin', 'sug'].includes(req.user.role);

    if (!isAuthorized) {
      return errorResponse(res, 'Not authorized to view this order', 403);
    }

    successResponse(res, {
      message: 'Order retrieved successfully',
      data: { order }
    });

  } catch (error) {
    console.error('Get order error:', error);
    errorResponse(res, error.message || 'Failed to get order', 500);
  }
};

// @desc    Get single order details (full info with populated fields)
// @route   GET /api/orders/:id/details
// @access  Private (Buyer/Vendor/Admin/SUG)
exports.getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('buyerId', 'fullname email phone matricNumber department faculty')
      .populate('items.productId', 'name images description')
      .populate('items.vendorId', 'fullname email phone businessName')
      .populate('items.storeId', 'storeName logo category')
      .populate('statusHistory.updatedBy', 'fullname role');

    if (!order) {
      return errorResponse(res, 'Order not found', 404);
    }

    // Authorization check
    const isBuyer = order.buyerId._id.toString() === req.user.id;
    const isVendor = order.items.some(
      item => item.vendorId._id.toString() === req.user.id
    );
    const isAdminOrSug = ['admin', 'sug'].includes(req.user.role);

    if (!isBuyer && !isVendor && !isAdminOrSug) {
      return errorResponse(res, 'Not authorized to view this order', 403);
    }

    // ✅ For vendors, only show their own items
    let filteredOrder = order.toObject();
    let viewerRole = 'admin';

    if (isBuyer) {
      viewerRole = 'buyer';
    } else if (isVendor && !isAdminOrSug) {
      viewerRole = 'vendor';
      filteredOrder.items = filteredOrder.items.filter(
        item => item.vendorId._id.toString() === req.user.id
      );
      // Recalculate subtotal for vendor's items only
      filteredOrder.vendorSubtotal = filteredOrder.items.reduce(
        (sum, item) => sum + item.subtotal,
        0
      );
    }

    successResponse(res, {
      message: 'Order details retrieved successfully',
      data: { order: filteredOrder, viewerRole }
    });

  } catch (error) {
    console.error('Get order details error:', error);
    errorResponse(res, error.message || 'Failed to get order details', 500);
  }
};

// @desc    Get vendor orders (list)
// @route   GET /api/orders/vendor/my-orders
// @access  Private (Vendor)
exports.getVendorOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { status } = req.query;

    const result = await orderService.getVendorOrders(req.user.id, {
      status,
      page,
      limit
    });

    successResponse(res, {
      message: 'Vendor orders retrieved successfully',
      data: {
        orders: result.orders,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: result.pages
        }
      }
    });

  } catch (error) {
    console.error('Get vendor orders error:', error);
    errorResponse(res, error.message || 'Failed to get vendor orders', 500);
  }
};

// @desc    Update order status (Vendor: processing/shipped only. Admin: any)
// @route   PUT /api/orders/:id/status
// @access  Private (Vendor/Admin)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;

    // ✅ Vendors can only move up to "shipped" - NOT delivered
    // Only buyer can mark as delivered (protection against scams)
    const vendorAllowedStatuses = ['processing', 'shipped'];
    const adminAllowedStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    const allowedStatuses = req.user.role === 'admin'
      ? adminAllowedStatuses
      : vendorAllowedStatuses;

    if (!allowedStatuses.includes(status)) {
      const message = req.user.role === 'vendor'
        ? `Invalid status. Vendors can only mark orders as 'processing' or 'shipped'. Only the buyer can confirm delivery.`
        : 'Invalid order status';

      return errorResponse(res, message, 400);
    }

    const order = await orderService.updateOrderStatus(
      req.params.id,
      status,
      req.user.id,
      note
    );

    // Add timestamp for shipped orders
    if (status === 'shipped') {
      order.shippedAt = new Date();
      await order.save();
    }

    successResponse(res, {
      message: `Order marked as ${status} successfully`,
      data: { order }
    });

  } catch (error) {
    console.error('Update order status error:', error);
    errorResponse(res, error.message || 'Failed to update order status', 500);
  }
};

// @desc    Confirm delivery (Buyer only - releases vendor payment)
// @route   PUT /api/orders/:id/confirm-delivery
// @access  Private (Student/Buyer)
exports.confirmDelivery = async (req, res) => {
  try {
    const { note } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return errorResponse(res, 'Order not found', 404);
    }

    // ✅ Only the buyer can confirm delivery
    if (order.buyerId.toString() !== req.user.id) {
      return errorResponse(res, 'Only the buyer can confirm delivery', 403);
    }

    // ✅ Order must be shipped first
    if (order.orderStatus !== 'shipped') {
      return errorResponse(
        res,
        `Cannot confirm delivery. Order status is currently '${order.orderStatus}'. It must be 'shipped' first.`,
        400
      );
    }

    // ✅ Payment must be paid
    if (order.paymentStatus !== 'paid') {
      return errorResponse(res, 'Cannot confirm delivery for unpaid order', 400);
    }

    // Update to delivered
    order.orderStatus = 'delivered';
    order.deliveredAt = new Date();
    order.statusHistory.push({
      status: 'delivered',
      updatedBy: req.user.id,
      note: note || 'Delivery confirmed by buyer',
      timestamp: new Date()
    });

    await order.save();

    // TODO: Trigger vendor payout / release funds
    // Uncomment when commissionService.releaseVendorPayment is implemented
    // try {
    //   await commissionService.releaseVendorPayment(order._id);
    // } catch (payoutError) {
    //   console.error('Payout release error:', payoutError);
    // }

    successResponse(res, {
      message: 'Delivery confirmed successfully. Thank you for shopping with us!',
      data: { order }
    });

  } catch (error) {
    console.error('Confirm delivery error:', error);
    errorResponse(res, error.message || 'Failed to confirm delivery', 500);
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
exports.cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await orderService.cancelOrder(
      req.params.id,
      req.user.id,
      reason || 'Cancelled by user'
    );

    successResponse(res, {
      message: 'Order cancelled successfully',
      data: { order }
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    errorResponse(res, error.message || 'Failed to cancel order', 500);
  }
};

// @desc    Get order statistics
// @route   GET /api/orders/statistics
// @access  Private (Vendor/Admin)
exports.getOrderStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const vendorId = req.user.role === 'vendor' ? req.user.id : null;

    const stats = await orderService.getOrderStatistics(vendorId, startDate, endDate);

    successResponse(res, {
      message: 'Order statistics retrieved successfully',
      data: { statistics: stats }
    });

  } catch (error) {
    console.error('Get statistics error:', error);
    errorResponse(res, error.message || 'Failed to get statistics', 500);
  }
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders/admin/all
// @access  Private (Admin)
exports.getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status, startDate, endDate } = req.query;

    let query = {};

    if (status) {
      query.orderStatus = status;
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await Order.find(query)
      .populate('buyerId', 'fullname email')
      .populate('items.vendorId', 'fullname')
      .populate('items.storeId', 'storeName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Order.countDocuments(query);

    successResponse(res, {
      message: 'Orders retrieved successfully',
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get all orders error:', error);
    errorResponse(res, error.message || 'Failed to get orders', 500);
  }
};