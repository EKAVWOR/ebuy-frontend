// server.js
const dotenv = require("dotenv");
const app = require("./src/app");
const connectDB = require("./src/config/database");

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
    ╔═══════════════════════════════════════╗
    ║   eBuy Server Running                 ║
    ║   Environment: ${(process.env.NODE_ENV || "development").padEnd(23)}║
    ║   Port: ${PORT.toString().padEnd(30)}║
    ╚═══════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
  server.close(() => process.exit(1));
});