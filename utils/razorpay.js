const crypto = require("crypto");
const Razorpay = require("razorpay");

function getRazorpayClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error(
      "Missing Razorpay credentials. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env"
    );
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

function createOrder({ amountPaise, currency = "INR", receipt }) {
  const razorpay = getRazorpayClient();
  return razorpay.orders.create({
    amount: amountPaise,
    currency,
    receipt: receipt || `rcpt_${Date.now()}`,
    payment_capture: 1,
  });
}

function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  // Constant-time comparison isn't critical here, but keep it deterministic.
  return expected === razorpaySignature;
}

module.exports = {
  createOrder,
  verifyPaymentSignature,
};

