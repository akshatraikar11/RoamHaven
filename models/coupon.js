const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const couponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "flat"],
      required: true,
    },
    // For percentage: store "15" for 15%
    // For flat: store "500" for ₹500
    discountValue: { type: Number, required: true },
    // Only used for percentage coupons (optional). In ₹
    maxDiscount: { type: Number, default: null },
    // In ₹
    minBookingAmount: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    usageLimit: { type: Number, required: true },
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

couponSchema.pre("save", function (next) {
  if (this.code) this.code = this.code.toUpperCase();
  next();
});

module.exports = mongoose.model("Coupon", couponSchema);

