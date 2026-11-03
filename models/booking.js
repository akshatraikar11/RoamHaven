const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
  listing: { type: Schema.Types.ObjectId, ref: "Listing" },
  user: { type: Schema.Types.ObjectId, ref: "User" },
  name: String,
  mobile: String,
  email: String,
  message: String,
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  timeSlot: String,
  guests: Number,
  meal: String,
  offer: String,

  // =============================
  // Payments & financial (#34-38)
  // =============================
  status: {
    type: String,
    // Feature #25: booking status workflow
    // "pending" is used for both request-to-book and pending payment verification (legacy compatibility)
    enum: ["pending", "confirmed", "checked_in", "completed", "cancelled"],
    default: "pending",
  },
  statusHistory: [
    {
      status: {
        type: String,
        enum: ["pending", "confirmed", "checked_in", "completed", "cancelled"],
      },
      at: { type: Date, default: Date.now },
      by: { type: Schema.Types.ObjectId, ref: "User" },
      note: String,
    },
  ],

  // Feature #27: price breakdown snapshot (all amounts in paise)
  pricing: {
    currency: { type: String, default: "INR" },
    nights: { type: Number, default: 1 },
    subtotal: { type: Number, default: 0 }, // nightly * nights (before fees/tax/discount)
    serviceFee: { type: Number, default: 0 },
    cleaningFee: { type: Number, default: 0 },
    taxes: { type: Number, default: 0 },
    totalBeforeDiscount: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalAfterDiscount: { type: Number, default: 0 },
    nightlyBreakdown: [
      {
        date: String, // YYYY-MM-DD
        priceRupees: Number,
        type: String,
      },
    ],
  },
  totalAmount: { type: Number, default: 0 }, // in paise (after discount)
  payment: { type: Schema.Types.ObjectId, ref: "Payment" },
  couponApplied: { type: Schema.Types.ObjectId, ref: "Coupon" },
  walletUsed: { type: Number, default: 0 }, // in paise
  gatewayAmount: { type: Number, default: 0 }, // in paise
  createdAt: { type: Date, default: Date.now },
});

bookingSchema.index({ listing: 1, status: 1, createdAt: -1 });
bookingSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Booking", bookingSchema);
