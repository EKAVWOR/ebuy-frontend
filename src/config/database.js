// src/config/database.js

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // ✅ ONE-TIME CLEANUP - Fix broken SKU index on products
    try {
      const productsCollection = mongoose.connection.db.collection('products');

      // 1. Delete products with empty/null SKU
      const emptyResult = await productsCollection.deleteMany({
        $or: [{ sku: '' }, { sku: null }]
      });
      if (emptyResult.deletedCount > 0) {
        console.log(`✅ Cleaned ${emptyResult.deletedCount} products with empty SKU`);
      }

      // 2. Check the current sku index
      const indexes = await productsCollection.indexes();
      const skuIndex = indexes.find(idx => idx.name === 'sku_1');

      // 3. Drop old index if it's not sparse (Mongoose will recreate as sparse)
      if (skuIndex && !skuIndex.sparse) {
        await productsCollection.dropIndex('sku_1');
        console.log('✅ Dropped old non-sparse sku_1 index (will be recreated as sparse)');
      }
    } catch (cleanupErr) {
      console.log('ℹ️ SKU cleanup skipped:', cleanupErr.message);
    }

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;