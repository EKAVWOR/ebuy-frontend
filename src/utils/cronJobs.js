// src/utils/cronJobs.js (NEW FILE)

const cron = require('node-cron');
const subscriptionService = require('../services/subscriptionService');
const logger = require('./logger');

/**
 * Run subscription expiry check daily at midnight
 */
const startSubscriptionExpiryJob = () => {
  cron.schedule('0 0 * * *', async () => {
    logger.info('Running subscription expiry check...');
    
    try {
      await subscriptionService.expireSubscriptions();
      logger.info('Subscription expiry check completed successfully');
    } catch (error) {
      logger.error('Subscription expiry check failed:', error);
    }
  });

  logger.info('Subscription expiry cron job scheduled (runs daily at midnight)');
};

module.exports = {
  startSubscriptionExpiryJob
};