// src/services/commissionService.js

const CommissionSetting = require('../models/CommissionSetting');
const SugCommission = require('../models/SugCommission');
const PlatformRevenue = require('../models/PlatformRevenue');
const VendorWallet = require('../models/VendorWallet');
const Order = require('../models/Order');
const User = require('../models/User');

class CommissionService {

  /**
   * Get active commission settings
   */
  async getCommissionSettings() {
    try {
      let settings = await CommissionSetting.findOne({ isActive: true })
        .sort({ createdAt: -1 });

      if (!settings) {
        const admin = await User.findOne({ role: 'admin' });
        settings = await CommissionSetting.create({
          vendorPercentage: 90,
          sugPercentage: 4,
          platformPercentage: 6,
          updatedBy: admin?._id,
          isActive: true
        });
      }

      return settings;
    } catch (error) {
      console.error('Get commission settings error:', error);
      throw new Error('Failed to get commission settings');
    }
  }

  /**
   * Calculate commission breakdown
   */
  async calculateCommissions(totalAmount) {
    try {
      const settings = await this.getCommissionSettings();

      return {
        totalAmount,
        vendorAmount: (totalAmount * settings.vendorPercentage) / 100,
        sugAmount: (totalAmount * settings.sugPercentage) / 100,
        platformAmount: (totalAmount * settings.platformPercentage) / 100,
        percentages: {
          vendor: settings.vendorPercentage,
          sug: settings.sugPercentage,
          platform: settings.platformPercentage
        }
      };
    } catch (error) {
      console.error('Calculate commissions error:', error);
      throw new Error('Failed to calculate commissions');
    }
  }

  /**
   * ✅ NEW - Process commissions after payment (holds funds as PENDING)
   * Called when payment succeeds — funds NOT released until buyer confirms delivery
   */
  async processCommissions(order) {
    try {
      const settings = await this.getCommissionSettings();
      const sugAccount = await User.findOne({ role: 'sug', status: 'active' });

      // Group items by vendor
      const vendorItems = {};
      order.items.forEach(item => {
        const vendorId = item.vendorId.toString();
        if (!vendorItems[vendorId]) {
          vendorItems[vendorId] = {
            vendorId: item.vendorId,
            storeId: item.storeId,
            subtotal: 0,
            items: []
          };
        }
        vendorItems[vendorId].subtotal += item.subtotal;
        vendorItems[vendorId].items.push(item);
      });

      // Credit each vendor's PENDING balance
      for (const vendorId in vendorItems) {
        const vendorData = vendorItems[vendorId];
        const vendorAmount = (vendorData.subtotal * settings.vendorPercentage) / 100;

        let wallet = await VendorWallet.findOne({ vendorId: vendorData.vendorId });

        if (!wallet) {
          wallet = await VendorWallet.create({
            vendorId: vendorData.vendorId,
            storeId: vendorData.storeId,
            pendingBalance: vendorAmount
          });
        } else {
          wallet.pendingBalance = (wallet.pendingBalance || 0) + vendorAmount;
        }

        // Add pending transaction
        wallet.addTransaction({
          type: 'pending',
          amount: vendorAmount,
          reference: order.paymentReference || `PENDING-${order._id}`,
          orderId: order._id,
          description: `Pending payment for order ${order.orderNumber}`,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance // Balance doesn't change yet
        });

        await wallet.save();
        console.log(`✅ Added ₦${vendorAmount} to pending balance for vendor ${vendorId}`);
      }

      // Record SUG commission (pending until delivery)
      if (sugAccount) {
        await SugCommission.create({
          sugId: sugAccount._id,
          orderId: order._id,
          amount: (order.totalAmount * settings.sugPercentage) / 100,
          percentage: settings.sugPercentage,
          orderAmount: order.totalAmount,
          status: 'pending', // ✅ Pending until delivery confirmed
          metadata: {
            buyerId: order.buyerId,
            vendorIds: Object.keys(vendorItems)
          }
        });
      }

      // Record platform revenue
      await PlatformRevenue.create({
        orderId: order._id,
        amount: (order.totalAmount * settings.platformPercentage) / 100,
        percentage: settings.platformPercentage,
        orderAmount: order.totalAmount,
        type: 'commission',
        status: 'pending',
        metadata: {
          buyerId: order.buyerId,
          vendorIds: Object.keys(vendorItems)
        }
      });

      return { success: true, vendorsCredited: Object.keys(vendorItems).length };
    } catch (error) {
      console.error('Process commissions error:', error);
      throw new Error('Failed to process commissions');
    }
  }

  /**
   * ✅ NEW - Release vendor payment (called when buyer confirms delivery)
   * Moves funds from pendingBalance → balance (available)
   */
  async releaseVendorPayment(orderId) {
    try {
      const order = await Order.findById(orderId);
      if (!order) throw new Error('Order not found');

      if (order.orderStatus !== 'delivered') {
        throw new Error('Order must be delivered before releasing payment');
      }

      if (order.paymentStatus !== 'paid') {
        throw new Error('Order must be paid before releasing payment');
      }

      const settings = await this.getCommissionSettings();

      // Group items by vendor
      const vendorItems = {};
      order.items.forEach(item => {
        const vendorId = item.vendorId.toString();
        if (!vendorItems[vendorId]) {
          vendorItems[vendorId] = {
            vendorId: item.vendorId,
            storeId: item.storeId,
            subtotal: 0
          };
        }
        vendorItems[vendorId].subtotal += item.subtotal;
      });

      const releasedPayments = [];

      // Release payment to each vendor
      for (const vendorId in vendorItems) {
        const vendorData = vendorItems[vendorId];
        const vendorAmount = (vendorData.subtotal * settings.vendorPercentage) / 100;

        let wallet = await VendorWallet.findOne({ vendorId: vendorData.vendorId });

        if (!wallet) {
          // Create wallet if missing
          wallet = await VendorWallet.create({
            vendorId: vendorData.vendorId,
            storeId: vendorData.storeId,
            balance: vendorAmount,
            totalEarnings: vendorAmount,
            pendingBalance: 0
          });
        } else {
          // Check if this order was already processed
          const alreadyReleased = wallet.transactions.some(
            t => t.orderId?.toString() === orderId.toString() && t.type === 'credit'
          );

          if (alreadyReleased) {
            console.log(`⚠️ Payment for order ${order.orderNumber} already released to vendor ${vendorId}`);
            continue;
          }

          // Move from pending to available balance
          const balanceBefore = wallet.balance;
          wallet.balance = (wallet.balance || 0) + vendorAmount;
          wallet.totalEarnings = (wallet.totalEarnings || 0) + vendorAmount;
          wallet.pendingBalance = Math.max(0, (wallet.pendingBalance || 0) - vendorAmount);

          // Add credit transaction
          wallet.transactions.unshift({
            type: 'credit',
            amount: vendorAmount,
            reference: order.paymentReference || `ORDER-${order._id}`,
            orderId: order._id,
            description: `Payment released for order ${order.orderNumber} (delivery confirmed)`,
            balanceBefore,
            balanceAfter: wallet.balance,
            createdAt: new Date()
          });

          // Keep last 100 transactions
          if (wallet.transactions.length > 100) {
            wallet.transactions = wallet.transactions.slice(0, 100);
          }
        }

        await wallet.save();

        releasedPayments.push({
          vendorId,
          amount: vendorAmount,
          newBalance: wallet.balance
        });

        console.log(`✅ Released ₦${vendorAmount} to vendor ${vendorId}. New balance: ₦${wallet.balance}`);
      }

      // Update SUG commission status to 'confirmed'
      await SugCommission.updateMany(
        { orderId: order._id, status: 'pending' },
        { $set: { status: 'confirmed', paidAt: new Date() } }
      );

      // Update platform revenue status
      await PlatformRevenue.updateMany(
        { orderId: order._id, status: 'pending' },
        { $set: { status: 'confirmed' } }
      );

      return {
        success: true,
        orderId: order._id,
        orderNumber: order.orderNumber,
        releasedPayments
      };

    } catch (error) {
      console.error('Release vendor payment error:', error);
      throw error;
    }
  }

  /**
   * Get SUG earnings summary
   */
  async getSugEarnings(sugId, startDate, endDate) {
    try {
      const query = { sugId, status: 'confirmed' };

      if (startDate && endDate) {
        query.paidAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const earnings = await SugCommission.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$amount' },
            totalOrders: { $sum: 1 },
            avgCommission: { $avg: '$amount' }
          }
        }
      ]);

      return earnings[0] || {
        totalEarnings: 0,
        totalOrders: 0,
        avgCommission: 0
      };
    } catch (error) {
      console.error('Get SUG earnings error:', error);
      throw new Error('Failed to get SUG earnings');
    }
  }

  /**
   * Get platform revenue summary
   */
  async getPlatformRevenue(startDate, endDate) {
    try {
      const query = { status: 'confirmed' };

      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const revenue = await PlatformRevenue.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$type',
            totalRevenue: { $sum: '$amount' },
            totalOrders: { $sum: 1 }
          }
        }
      ]);

      const summary = revenue.reduce((acc, item) => {
        acc[item._id] = {
          totalRevenue: item.totalRevenue,
          totalOrders: item.totalOrders
        };
        return acc;
      }, {});

      const totalRevenue = revenue.reduce((sum, item) => sum + item.totalRevenue, 0);
      const totalOrders = revenue.reduce((sum, item) => sum + item.totalOrders, 0);

      return {
        totalRevenue,
        totalOrders,
        breakdown: summary
      };
    } catch (error) {
      console.error('Get platform revenue error:', error);
      throw new Error('Failed to get platform revenue');
    }
  }
}

module.exports = new CommissionService();