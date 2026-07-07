// src/config/paystack.js

const axios = require('axios');

const paystackAPI = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor nnreads the key fresh on EVERY request
paystackAPI.interceptors.request.use(
  (config) => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return Promise.reject(
        new Error(
          'PAYSTACK_SECRET_KEY is not defined in environment variables. ' +
          'Check your Backend/.env file.'
        )
      );
    }

    config.headers.Authorization = `Bearer ${secretKey}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

module.exports = paystackAPI;