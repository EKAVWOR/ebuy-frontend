// src/services/walletService.js

const VendorWallet = require('../models/VendorWallet');
const Order = require('../models/Order');
const CommissionSetting = require('../models/CommissionSetting');

class WalletService {

  /**
   * Get or create vendor wallet
   */
  async getOrCreateWallet(vendorId, storeId) {
    try {
      let wallet = await VendorWallet.findOne({ vendorId });

      if (!wallet) {
        wallet = await VendorWallet.create({
          vendorId,
          storeId,
          balance: 0,
          pendingBalance: 0,
          totalEarnings: 0,
          totalWithdrawals: 0,
          transactions: []
        });
      }

      return wallet;
    } catch (error) {
      console.error('Get/Create wallet error:', error);
      throw new Error('Failed to get or create wallet');
    }
  }

  /**
   * Credit vendor wallet for completed order
   */
  async creditVendorsForOrder(order) {
    try {
      // Get commission settings
      const commissionSetting = await CommissionSetting.findOne({ isActive: true })
        .sort({ createdAt: -1 });

      if (!commissionSetting) {
        throw new Error('Commission settings not found');
      }

      const vendorPercentage = commissionSetting.vendorPercentage / 100;

      // Group items by vendor
      const vendorItems = {};
      order.items.forEach(item => {
        const vendorId = item.vendorId.toString();
        if (!vendorItems[vendorId]) {
          vendorItems[vendorId] = {
            vendorId: item.vendorId,
            storeId: item.storeId,
            items: [],
            subtotal: 0
          };
        }
        vendorItems[vendorId].items.push(item);
        vendorItems[vendorId].subtotal += item.subtotal;
      });

      // Credit each vendor
      for (const vendorId in vendorItems) {
        const vendorData = vendorItems[vendorId];
        const vendorEarning = vendorData.subtotal * vendorPercentage;

        const wallet = await this.getOrCreateWallet(vendorData.vendorId, vendorData.storeId);

        // Add to pending balance first
        const balanceBefore = wallet.pendingBalance;
        wallet.pendingBalance += vendorEarning;

        // Add transaction
        wallet.addTransaction({
          type: 'pending',
          amount: vendorEarning,
          reference: order.orderNumber,
          orderId: order._id,
          description: `Pending earning from order ${order.orderNumber}`,
          balanceAfter: wallet.pendingBalance
        });

        await wallet.save();
      }

      return true;
    } catch (error) {
      console.error('Credit vendors error:', error);
      throw new Error('Failed to credit vendor wallets');
    }
  }

  /**
   * Move pending balance to available balance (after order delivery/confirmation)
   */
  async confirmOrderEarnings(orderId) {
    try {
      const order = await Order.findById(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      // Get commission settings
      const commissionSetting = await CommissionSetting.findOne({ isActive: true })
        .sort({ createdAt: -1 });

      const vendorPercentage = commissionSetting.vendorPercentage / 100;

      // Group items by vendor
      const vendorItems = {};
      order.items.forEach(item => {
        const vendorId = item.vendorId.toString();
        if (!vendorItems[vendorId]) {
          vendorItems[vendorId] = { subtotal: 0 };
        }
        vendorItems[vendorId].subtotal += item.subtotal;
      });

      // Confirm earnings for each vendor
      for (const vendorId in vendorItems) {
        const vendorEarning = vendorItems[vendorId].subtotal * vendorPercentage;

        const wallet = await VendorWallet.findOne({ vendorId });

        if (wallet) {
          const balanceBefore = wallet.balance;

          // Move from pending to available
          wallet.pendingBalance -= vendorEarning;
          wallet.balance += vendorEarning;
          wallet.totalEarnings += vendorEarning;

          // Add transaction
          wallet.addTransaction({
            type: 'credit',
            amount: vendorEarning,
            reference: order.orderNumber,
            orderId: order._id,
            description: `Confirmed earning from order ${order.orderNumber}`,
            balanceAfter: wallet.balance
          });

          await wallet.save();
        }
      }

      return true;
    } catch (error) {
      console.error('Confirm earnings error:', error);
      throw new Error('Failed to confirm order earnings');
    }
  }

  /**
   * Debit wallet for withdrawal
   */
  async debitWallet(vendorId, amount, withdrawalId, description) {
    try {
      const wallet = await VendorWallet.findOne({ vendorId });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (wallet.balance < amount) {
        throw new Error('Insufficient wallet balance');
      }

      const balanceBefore = wallet.balance;

      wallet.balance -= amount;
      wallet.totalWithdrawals += amount;

      // Add transaction
      wallet.addTransaction({
        type: 'debit',
        amount: amount,
        reference: withdrawalId,
        description: description || 'Withdrawal',
        balanceAfter: wallet.balance
      });

      await wallet.save();

      return wallet;
    } catch (error) {
      console.error('Debit wallet error:', error);
      throw error;
    }
  }

  /**
   * Reverse withdrawal (if failed)
   */
  async reverseWithdrawal(vendorId, amount, withdrawalId) {
    try {
      const wallet = await VendorWallet.findOne({ vendorId });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const balanceBefore = wallet.balance;

      wallet.balance += amount;
      wallet.totalWithdrawals -= amount;

      // Add reversal transaction
      wallet.addTransaction({
        type: 'reversal',
        amount: amount,
        reference: withdrawalId,
        description: 'Withdrawal reversal - failed transfer',
        balanceAfter: wallet.balance
      });

      await wallet.save();

      return wallet;
    } catch (error) {
      console.error('Reverse withdrawal error:', error);
      throw error;
    }
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(vendorId) {
    try {
      const wallet = await VendorWallet.findOne({ vendorId });

      if (!wallet) {
        return {
          balance: 0,
          pendingBalance: 0,
          totalEarnings: 0,
          totalWithdrawals: 0
        };
      }

      return {
        balance: wallet.balance,
        pendingBalance: wallet.pendingBalance,
        totalEarnings: wallet.totalEarnings,
        totalWithdrawals: wallet.totalWithdrawals
      };
    } catch (error) {
      console.error('Get wallet balance error:', error);
      throw new Error('Failed to get wallet balance');
    }
  }

  /**
   * Get wallet transactions
   */
  async getWalletTransactions(vendorId, page = 1, limit = 20) {
    try {
      const wallet = await VendorWallet.findOne({ vendorId })
        .select('transactions')
        .slice('transactions', [(page - 1) * limit, limit]);

      if (!wallet) {
        return {
          transactions: [],
          total: 0
        };
      }

      const totalWallet = await VendorWallet.findOne({ vendorId });
      const total = totalWallet ? totalWallet.transactions.length : 0;

      return {
        transactions: wallet.transactions,
        total
      };
    } catch (error) {
      console.error('Get wallet transactions error:', error);
      throw new Error('Failed to get wallet transactions');
    }
  }
}

module.exports = new WalletService();