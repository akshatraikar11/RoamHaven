const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const walletSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", unique: true, required: true },
    balance: { type: Number, default: 0 }, // in paise
    transactions: [
      {
        type: { type: String, enum: ["credit", "debit"], required: true },
        amount: { type: Number, required: true }, // in paise
        description: { type: String, required: true },
        reference: { type: Schema.Types.ObjectId },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: false }
);

module.exports = mongoose.model("Wallet", walletSchema);

