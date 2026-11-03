const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  // Feature #49: Profile
  bio: { type: String, default: "" },
  languages: [{ type: String }],
  avatar: {
    url: String,
    filename: String,
  },
  phone: { type: String, default: "" },
  isPhoneVerified: { type: Boolean, default: false },
  // Feature #1: RBAC
  role: {
    type: String,
    enum: ["guest", "host", "admin"],
    default: "guest",
  },
  // Feature #2: Email Verification
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  // Feature #3: Forgot Password
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  // Feature #8: Login Activity Log
  loginHistory: [
    {
      ip: String,
      device: String,
      browser: String,
      timestamp: { type: Date, default: Date.now },
      success: { type: Boolean, default: true },
    },
  ],

  // Payments & financial (#38)
  wallet: { type: Schema.Types.ObjectId, ref: "Wallet" },

  // Feature #52: Wishlist / Favorites
  favorites: [{ type: Schema.Types.ObjectId, ref: "Listing" }],

  // Feature #57: Referral system
  referralCode: { type: String, unique: true, sparse: true },
  referredByCode: { type: String, default: null },
  referralRewarded: { type: Boolean, default: false },

  // Feature #139 + #147: gamification badges + loyalty points
  loyaltyPoints: { type: Number, default: 0 },
  badges: [
    {
      key: String,
      label: String,
      earnedAt: { type: Date, default: Date.now },
    },
  ],

  // Feature #144: guest verification via ID upload
  idVerification: {
    status: {
      type: String,
      enum: ["unverified", "pending", "verified", "rejected"],
      default: "unverified",
    },
    idImage: {
      url: String,
      filename: String,
    },
    submittedAt: Date,
  },
});

// Keep only the last 50 login history entries
userSchema.pre("save", function (next) {
  if (this.loginHistory && this.loginHistory.length > 50) {
    this.loginHistory = this.loginHistory.slice(-50);
  }
  next();
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);