// src/services/emailService.js

const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendEmail(to, subject, html) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'eBuy <noreply@ebuy.com>',
        to,
        subject,
        html
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Email send error:', error);
      return false;
    }
  }

  async sendOrderConfirmation(order, user) {
    const subject = `Order Confirmation - ${order.orderNumber}`;
    const html = `
      <h2>Order Confirmed!</h2>
      <p>Hi ${user.fullname},</p>
      <p>Your order <strong>${order.orderNumber}</strong> has been confirmed.</p>
      <p>Total Amount: ₦${order.totalAmount.toLocaleString()}</p>
      <p>Thank you for shopping with eBuy!</p>
    `;
    
    return await this.sendEmail(user.email, subject, html);
  }

  async sendPaymentConfirmation(payment, order, user) {
    const subject = `Payment Received - ${order.orderNumber}`;
    const html = `
      <h2>Payment Successful!</h2>
      <p>Hi ${user.fullname},</p>
      <p>We've received your payment of ₦${payment.amount.toLocaleString()}</p>
      <p>Order Number: ${order.orderNumber}</p>
      <p>Your order is being processed.</p>
    `;
    
    return await this.sendEmail(user.email, subject, html);
  }

  async sendStoreApprovalNotification(store, vendor) {
    const subject = store.isApproved 
      ? 'Store Approved - Welcome to eBuy!' 
      : 'Store Application Status';
    
    const html = store.isApproved
      ? `
        <h2>Congratulations!</h2>
        <p>Hi ${vendor.fullname},</p>
        <p>Your store <strong>${store.storeName}</strong> has been approved.</p>
        <p>You can now start adding products and selling on eBuy.</p>
      `
      : `
        <h2>Store Application Update</h2>
        <p>Hi ${vendor.fullname},</p>
        <p>Unfortunately, your store application was not approved at this time.</p>
        <p>Please contact support for more information.</p>
      `;
    
    return await this.sendEmail(vendor.email, subject, html);
  }

  async sendWithdrawalNotification(withdrawal, vendor, status) {
    const subject = `Withdrawal Request ${status}`;
    const html = `
      <h2>Withdrawal Update</h2>
      <p>Hi ${vendor.fullname},</p>
      <p>Your withdrawal request of ₦${withdrawal.amount.toLocaleString()} has been ${status}.</p>
      ${status === 'completed' ? '<p>Funds have been transferred to your account.</p>' : ''}
      ${status === 'rejected' ? `<p>Reason: ${withdrawal.rejectionReason}</p>` : ''}
    `;
    
    return await this.sendEmail(vendor.email, subject, html);
  }
}

module.exports = new EmailService();