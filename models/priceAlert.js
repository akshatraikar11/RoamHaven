const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const priceAlertSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    targetPrice: { type: Number, required: true }, // in rupees
    isActive: { type: Boolean, default: true },
    isTriggered: { type: Boolean, default: false },
    triggeredAt: Date,
  },
  { timestamps: true }
);

priceAlertSchema.index({ user: 1, listing: 1 }, { unique: true });
priceAlertSchema.index({ listing: 1, targetPrice: 1, isActive: 1 });

module.exports = mongoose.model("PriceAlert", priceAlertSchema);
