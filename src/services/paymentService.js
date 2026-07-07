// src/services/paymentService.js

const paystackAPI = require('../config/paystack');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const { v4: uuidv4 } = require('uuid');

class PaymentService {
  
  /**
   * Initialize Paystack payment
   */
  async initializePayment(order, user) {
    try {
      const paymentReference = `PAY-${Date.now()}-${uuidv4()}`;
      
      const paymentData = {
        email: user.email,
        amount: Math.round(order.totalAmount * 100), // Convert to kobo
        reference: paymentReference,
        callback_url: `${process.env.FRONTEND_URL}/payment/verify`,
        metadata: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          userId: user._id.toString(),
          fullname: user.fullname,
          phone: user.phone
        }
      };

      // Call Paystack API
      const response = await paystackAPI.post('/transaction/initialize', paymentData);

      if (!response.data.status) {
        throw new Error('Payment initialization failed');
      }

      const { authorization_url, access_code, reference } = response.data.data;

      // Create payment record
      const payment = await Payment.create({
        orderId: order._id,
        buyerId: user._id,
        amount: order.totalAmount,
        paymentReference,
        paystackReference: reference,
        authorizationUrl: authorization_url,
        accessCode: access_code,
        status: 'pending',
        metadata: paymentData.metadata
      });

      // Update order with payment reference
      order.paymentReference = paymentReference;
      await order.save();

      return {
        authorizationUrl: authorization_url,
        accessCode: access_code,
        reference: paymentReference,
        payment
      };

    } catch (error) {
      console.error('Payment initialization error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Payment initialization failed');
    }
  }

  /**
   * Verify Paystack payment
   */
  async verifyPayment(reference) {
    try {
      // Get payment record
      const payment = await Payment.findOne({ paymentReference: reference });

      if (!payment) {
        throw new Error('Payment record not found');
      }

      if (payment.status === 'success') {
        return { payment, alreadyVerified: true };
      }

      // Verify with Paystack
      const response = await paystackAPI.get(`/transaction/verify/${reference}`);

      if (!response.data.status) {
        throw new Error('Payment verification failed');
      }

      const { data } = response.data;

      // Check if payment was successful
      if (data.status !== 'success') {
        payment.status = 'failed';
        await payment.save();
        throw new Error('Payment was not successful');
      }

      // Update payment record
      payment.status = 'success';
      payment.paidAt = new Date(data.paid_at);
      payment.channel = data.channel;
      payment.paystackResponse = data;
      await payment.save();

      // Update order
      const order = await Order.findById(payment.orderId);
      if (order) {
        order.paymentStatus = 'paid';
        order.orderStatus = 'processing';
        await order.save();
      }

      return { payment, order, alreadyVerified: false };

    } catch (error) {
      console.error('Payment verification error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Payment verification failed');
    }
  }

  /**
   * Process refund
   */
  async processRefund(orderId, reason) {
    try {
      const payment = await Payment.findOne({ orderId, status: 'success' });

      if (!payment) {
        throw new Error('Payment not found or not eligible for refund');
      }

      // Call Paystack refund API
      const response = await paystackAPI.post('/refund', {
        transaction: payment.paystackReference,
        amount: Math.round(payment.amount * 100),
        merchant_note: reason
      });

      if (!response.data.status) {
        throw new Error('Refund processing failed');
      }

      // Update payment status
      payment.status = 'refunded';
      await payment.save();

      // Update order
      const order = await Order.findById(orderId);
      if (order) {
        order.paymentStatus = 'refunded';
        order.orderStatus = 'cancelled';
        await order.save();
      }

      return { payment, order };

    } catch (error) {
      console.error('Refund error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Refund processing failed');
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(startDate, endDate) {
    try {
      const stats = await Payment.aggregate([
        {
          $match: {
            status: 'success',
            paidAt: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalTransactions: { $sum: 1 },
            avgTransactionValue: { $avg: '$amount' }
          }
        }
      ]);

      return stats[0] || {
        totalAmount: 0,
        totalTransactions: 0,
        avgTransactionValue: 0
      };

    } catch (error) {
      console.error('Payment stats error:', error);
      throw new Error('Failed to get payment statistics');
    }
  }
}

module.exports = new PaymentService();