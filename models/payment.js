const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const paymentSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true }, // payer (guest)
    listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true },

    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    upiUtr: String,
    paymentMethod: { type: String, enum: ["razorpay", "wallet", "upi"], default: "razorpay" },

    // Total paid for this booking (after discount), in paise
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },

    status: {
      type: String,
      enum: ["created", "paid", "failed", "refunded"],
      default: "created",
    },

    couponUsed: { type: Schema.Types.ObjectId, ref: "Coupon" },
    // discount amount in paise
    discount: { type: Number, default: 0 },

    platformFee: { type: Number, default: 0 }, // commission in paise (10%)
    hostPayout: { type: Number, default: 0 }, // host payout in paise (90%)

    // Wallet coverage for this booking (in paise). Optional but needed for ledgers.
    walletUsed: { type: Number, default: 0 },

    // Amount charged via Razorpay (in paise). Optional, used for order creation/refunds.
    gatewayAmount: { type: Number, default: 0 },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

paymentSchema.index({ listing: 1, status: 1, createdAt: -1 });
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ razorpayOrderId: 1 }, { sparse: true });

module.exports = mongoose.model("Payment", paymentSchema);

