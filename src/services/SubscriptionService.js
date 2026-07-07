// src/services/subscriptionService.js

const Subscription = require('../models/Subscription');
const Store = require('../models/Store');
const paystackAPI = require('../config/paystack');
const { v4: uuidv4 } = require('uuid');

class SubscriptionService {

  /**
   * Get all available plans
   */
  getAvailablePlans() {
    return {
      basic: Subscription.getPlanDetails('basic'),
      standard: Subscription.getPlanDetails('standard'),
      premium: Subscription.getPlanDetails('premium')
    };
  }

  /**
   * Initialize subscription payment
   */
  async initializeSubscription(vendorId, planName, userEmail) {
    try {
      const planDetails = Subscription.getPlanDetails(planName);
      
      if (!planDetails) {
        throw new Error('Invalid subscription plan');
      }

      const paymentReference = `SUB-${Date.now()}-${uuidv4()}`;

      // Create subscription record
      const subscription = await Subscription.create({
        vendorId,
        plan: planName,
        amount: planDetails.price,
        paymentReference,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: 'pending',
        paymentStatus: 'pending',
        features: {
          maxProducts: planDetails.maxProducts,
          maxImages: planDetails.maxImages,
          analytics: planDetails.analytics,
          prioritySupport: planDetails.prioritySupport,
          featuredStore: planDetails.featuredStore
        }
      });

      // Initialize Paystack payment
      const paymentData = {
        email: userEmail,
        amount: planDetails.price * 100, // Convert to kobo
        reference: paymentReference,
        callback_url: `${process.env.FRONTEND_URL}/vendor/subscription/verify`,
        metadata: {
          subscriptionId: subscription._id.toString(),
          vendorId: vendorId.toString(),
          plan: planName,
          type: 'subscription'
        }
      };

      const response = await paystackAPI.post('/transaction/initialize', paymentData);

      if (!response.data.status) {
        throw new Error('Payment initialization failed');
      }

      const { authorization_url, access_code, reference } = response.data.data;

      subscription.paystackReference = reference;
      await subscription.save();

      return {
        subscription,
        authorizationUrl: authorization_url,
        accessCode: access_code,
        reference: paymentReference
      };

    } catch (error) {
      console.error('Subscription initialization error:', error);
      throw error;
    }
  }

  /**
   * Verify subscription payment
   */
  async verifySubscriptionPayment(reference) {
    try {
      const subscription = await Subscription.findOne({ paymentReference: reference });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (subscription.paymentStatus === 'paid') {
        return { subscription, alreadyVerified: true };
      }

      // Verify with Paystack
      const response = await paystackAPI.get(`/transaction/verify/${reference}`);

      if (!response.data.status || response.data.data.status !== 'success') {
        subscription.paymentStatus = 'failed';
        subscription.status = 'cancelled';
        await subscription.save();
        throw new Error('Payment verification failed');
      }

      // Activate subscription
      subscription.paymentStatus = 'paid';
      subscription.status = 'active';
      subscription.startDate = new Date();
      await subscription.save();

      // Update or create store
      await this.activateStoreSubscription(subscription.vendorId, subscription._id);

      return { subscription, alreadyVerified: false };

    } catch (error) {
      console.error('Payment verification error:', error);
      throw error;
    }
  }

  /**
   * Activate store subscription
   */
  async activateStoreSubscription(vendorId, subscriptionId) {
    try {
      const store = await Store.findOne({ owner: vendorId });

      if (store) {
        store.currentSubscription = subscriptionId;
        if (store.status === 'subscription_expired') {
          store.status = 'active';
        }
        await store.save();
      }

      return store;
    } catch (error) {
      console.error('Store activation error:', error);
      throw error;
    }
  }

  /**
   * Get vendor's current subscription
   */
  async getVendorSubscription(vendorId) {
    try {
      const subscription = await Subscription.findOne({
        vendorId,
        status: { $in: ['active', 'expired'] }
      })
      .sort({ createdAt: -1 })
      .populate('storeId', 'storeName');

      return subscription;
    } catch (error) {
      console.error('Get subscription error:', error);
      throw error;
    }
  }

  /**
   * Get subscription history
   */
  async getSubscriptionHistory(vendorId) {
    try {
      const subscriptions = await Subscription.find({ vendorId })
        .sort({ createdAt: -1 })
        .limit(10);

      return subscriptions;
    } catch (error) {
      console.error('Get history error:', error);
      throw error;
    }
  }

  /**
   * Check if vendor can create store
   */
  async canCreateStore(vendorId) {
    try {
      const subscription = await Subscription.findOne({
        vendorId,
        status: 'active',
        expiryDate: { $gt: new Date() },
        paymentStatus: 'paid'
      });

      return !!subscription;
    } catch (error) {
      console.error('Check subscription error:', error);
      return false;
    }
  }

  /**
   * Check if vendor can add products
   */
  async canAddProducts(vendorId, currentProductCount) {
    try {
      const subscription = await this.getVendorSubscription(vendorId);

      if (!subscription || subscription.status !== 'active') {
        return { canAdd: false, reason: 'No active subscription' };
      }

      if (subscription.isExpired()) {
        return { canAdd: false, reason: 'Subscription expired' };
      }

      const maxProducts = subscription.features.maxProducts;
      
      // -1 means unlimited
      if (maxProducts === -1) {
        return { canAdd: true, remaining: -1 };
      }

      if (currentProductCount >= maxProducts) {
        return { 
          canAdd: false, 
          reason: `Product limit reached (${maxProducts}). Upgrade your plan.`,
          limit: maxProducts
        };
      }

      return { 
        canAdd: true, 
        remaining: maxProducts - currentProductCount,
        limit: maxProducts
      };

    } catch (error) {
      console.error('Check product limit error:', error);
      return { canAdd: false, reason: 'Error checking subscription' };
    }
  }

  /**
   * Expire subscriptions (run daily via cron)
   */
  async expireSubscriptions() {
    try {
      // Expire subscriptions
      await Subscription.expireSubscriptions();

      // Update stores with expired subscriptions
      const expiredSubscriptions = await Subscription.find({
        status: 'expired'
      }).select('_id');

      const expiredIds = expiredSubscriptions.map(s => s._id);

      await Store.updateMany(
        { currentSubscription: { $in: expiredIds } },
        { $set: { status: 'subscription_expired' } }
      );

      console.log('Subscription expiry check completed');
    } catch (error) {
      console.error('Expire subscriptions error:', error);
    }
  }

  /**
   * Get subscription statistics for admin
   */
  async getSubscriptionStats(startDate, endDate) {
    try {
      const matchQuery = {};
      
      if (startDate && endDate) {
        matchQuery.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const stats = await Subscription.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$amount' }
          }
        }
      ]);

      const planStats = await Subscription.aggregate([
        { $match: { ...matchQuery, status: 'active' } },
        {
          $group: {
            _id: '$plan',
            count: { $sum: 1 },
            revenue: { $sum: '$amount' }
          }
        }
      ]);

      return {
        byStatus: stats,
        byPlan: planStats
      };

    } catch (error) {
      console.error('Get stats error:', error);
      throw error;
    }
  }

  /**
   * Renew subscription
   */
  async renewSubscription(vendorId, userEmail) {
    try {
      const currentSubscription = await this.getVendorSubscription(vendorId);

      if (!currentSubscription) {
        throw new Error('No subscription found to renew');
      }

      // Initialize new subscription payment with same plan
      return await this.initializeSubscription(
        vendorId,
        currentSubscription.plan,
        userEmail
      );

    } catch (error) {
      console.error('Renew subscription error:', error);
      throw error;
    }
  }
}

module.exports = new SubscriptionService();