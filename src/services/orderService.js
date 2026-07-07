// src/services/orderService.js

const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Store = require('../models/Store');

class OrderService {

  /**
   * Create order from cart
   */
  async createOrderFromCart(userId, shippingAddress, notes = '') {
    try {
      // Get user's cart
      const cart = await Cart.findOne({ userId }).populate('items.productId');

      if (!cart || cart.items.length === 0) {
        throw new Error('Cart is empty');
      }

      // Validate all products are available
      const orderItems = [];
      let subtotal = 0;

      for (const cartItem of cart.items) {
        const product = cartItem.productId;

        if (!product) {
          throw new Error('Product not found');
        }

        if (product.status !== 'active') {
          throw new Error(`Product "${product.name}" is not available`);
        }

        if (product.stock < cartItem.quantity) {
          throw new Error(`Insufficient stock for "${product.name}"`);
        }

        const itemSubtotal = product.price * cartItem.quantity;
        subtotal += itemSubtotal;

        orderItems.push({
          productId: product._id,
          vendorId: product.vendorId,
          storeId: product.storeId,
          productName: product.name,
          productImage: product.images[0] || null,
          quantity: cartItem.quantity,
          price: product.price,
          subtotal: itemSubtotal
        });
      }

      // Calculate platform fee (10%)
      const platformFee = subtotal * 0.10;
      const totalAmount = subtotal + platformFee;

      // Create order
      const order = await Order.create({
        buyerId: userId,
        items: orderItems,
        subtotal,
        platformFee,
        totalAmount,
        shippingAddress,
        notes,
        orderStatus: 'pending',
        paymentStatus: 'pending'
      });

      // Update product stock
      for (const item of orderItems) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.quantity, 'metrics.sales': item.quantity }
        });
      }

      // Clear cart
      cart.items = [];
      await cart.save();

      return order;

    } catch (error) {
      console.error('Create order error:', error);
      throw error;
    }
  }

  /**
   * Get order with full details
   */
  async getOrderDetails(orderId) {
    try {
      const order = await Order.findById(orderId)
        .populate('buyerId', 'fullname email phone')
        .populate('items.productId', 'name images')
        .populate('items.vendorId', 'fullname email')
        .populate('items.storeId', 'storeName');

      return order;
    } catch (error) {
      console.error('Get order details error:', error);
      throw new Error('Failed to get order details');
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId, newStatus, updatedBy, note = '') {
    try {
      const order = await Order.findById(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      const previousStatus = order.orderStatus;
      order.orderStatus = newStatus;

      // Add to status history
      order.statusHistory.push({
        status: newStatus,
        updatedBy,
        note,
        timestamp: new Date()
      });

      await order.save();

      // If order is delivered, confirm vendor earnings
      if (newStatus === 'delivered' && previousStatus !== 'delivered') {
        const walletService = require('./walletService');
        await walletService.confirmOrderEarnings(orderId);
      }

      return order;
    } catch (error) {
      console.error('Update order status error:', error);
      throw error;
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId, cancelledBy, reason) {
    try {
      const order = await Order.findById(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.orderStatus === 'delivered') {
        throw new Error('Cannot cancel delivered order');
      }

      if (order.paymentStatus === 'paid') {
        // Process refund
        const paymentService = require('./paymentService');
        await paymentService.processRefund(orderId, reason);
      }

      // Restore product stock
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity, 'metrics.sales': -item.quantity }
        });
      }

      order.orderStatus = 'cancelled';
      order.statusHistory.push({
        status: 'cancelled',
        updatedBy: cancelledBy,
        note: reason,
        timestamp: new Date()
      });

      await order.save();

      return order;
    } catch (error) {
      console.error('Cancel order error:', error);
      throw error;
    }
  }

  /**
   * Get vendor orders
   */
  async getVendorOrders(vendorId, filters = {}) {
    try {
      const { status, page = 1, limit = 10 } = filters;
      const skip = (page - 1) * limit;

      const query = { 'items.vendorId': vendorId };

      if (status) {
        query.orderStatus = status;
      }

      const orders = await Order.find(query)
        .populate('buyerId', 'fullname email phone')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

      const total = await Order.countDocuments(query);

      // Filter items to only show vendor's products
      const filteredOrders = orders.map(order => {
        const orderObj = order.toObject();
        orderObj.items = orderObj.items.filter(
          item => item.vendorId.toString() === vendorId.toString()
        );
        return orderObj;
      });

      return {
        orders: filteredOrders,
        total,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Get vendor orders error:', error);
      throw new Error('Failed to get vendor orders');
    }
  }

  /**
   * Get order statistics
   */
  async getOrderStatistics(vendorId = null, startDate = null, endDate = null) {
    try {
      let matchQuery = {};

      if (vendorId) {
        matchQuery['items.vendorId'] = vendorId;
      }

      if (startDate && endDate) {
        matchQuery.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const stats = await Order.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$orderStatus',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' }
          }
        }
      ]);

      const summary = {
        total: 0,
        pending: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        totalRevenue: 0
      };

      stats.forEach(stat => {
        summary[stat._id] = stat.count;
        summary.total += stat.count;
        if (stat._id !== 'cancelled') {
          summary.totalRevenue += stat.totalAmount;
        }
      });

      return summary;
    } catch (error) {
      console.error('Get order statistics error:', error);
      throw new Error('Failed to get order statistics');
    }
  }
}

module.exports = new OrderService();