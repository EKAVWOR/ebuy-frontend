// server.js

const dotenv = require('dotenv');
const app = require('./src/app');
const connectDB = require('./src/config/database');
const { startSubscriptionExpiryJob } = require('./src/utils/cronJobs');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();


if (process.env.NODE_ENV === 'production') {
  startSubscriptionExpiryJob();
  console.log('✓ Cron jobs started');
}

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
    ╔═══════════════════════════════════════╗
    ║   eBuy Server Running                 ║
    ║   Environment: ${process.env.NODE_ENV?.padEnd(23) || 'development'.padEnd(23)}║
    ║   Port: ${PORT.toString().padEnd(30)}║
    ╚═══════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  server.close(() => process.exit(1));
});