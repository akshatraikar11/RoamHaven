const User = require("../models/user");
const UserSession = require("../models/session");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Review = require("../models/review");
const Wallet = require("../models/wallet");
const Payment = require("../models/payment");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { NotFoundError } = require("../utils/ExpressError");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../utils/email");
const UAParser = require("ua-parser-js");

// ==============================
// Helper: Parse user agent info
// ==============================
function parseUserAgent(req) {
  const parser = new UAParser(req.headers["user-agent"]);
  const result = parser.getResult();
  return {
    browser: `${result.browser.name || "Unknown"} ${result.browser.version || ""}`.trim(),
    device: result.device.model || result.device.type || "Desktop",
    os: `${result.os.name || "Unknown"} ${result.os.version || ""}`.trim(),
    ip: req.ip || req.connection.remoteAddress || "Unknown",
  };
}

// ==============================
// Helper: Record login activity
// ==============================
async function recordLogin(user, req, success = true) {
  const info = parseUserAgent(req);
  user.loginHistory.push({
    ip: info.ip,
    device: info.device,
    browser: info.browser,
    timestamp: new Date(),
    success,
  });
  await user.save();
}

// ==============================
// Helper: Track session
// ==============================
async function trackSession(user, req) {
  const info = parseUserAgent(req);
  const sessionId = req.sessionID;

  // Upsert session record
  await UserSession.findOneAndUpdate(
    { sessionId },
    {
      userId: user._id,
      sessionId,
      ip: info.ip,
      device: info.device,
      browser: info.browser,
      os: info.os,
      lastActive: new Date(),
    },
    { upsert: true, new: true }
  );
}

// ==============================
// Existing: Signup, Login, Logout
// ==============================

module.exports.renderSignupForm = (req, res) => {
  const ref = (req.query.ref || "").toString().trim().toUpperCase();
  res.render("users/signup.ejs", { ref });
};

module.exports.signup = async (req, res, next) => {
  try {
    let { username, email, password, ref } = req.body;
    const newUser = new User({ email, username });
    const registeredUser = await User.register(newUser, password);

    // Feature #57: referral tracking (rewarded on first confirmed booking)
    const referralCode = String(ref || "").trim().toUpperCase();
    if (referralCode) {
      const referrerExists = await User.exists({ referralCode });
      if (referrerExists) {
        registeredUser.referredByCode = referralCode;
      }
    }

    // Generate user's own referral code
    if (!registeredUser.referralCode) {
      for (let i = 0; i < 5; i++) {
        const code = crypto
          .randomBytes(4)
          .toString("hex")
          .slice(0, 8)
          .toUpperCase();
        const taken = await User.exists({ referralCode: code });
        if (!taken) {
          registeredUser.referralCode = code;
          break;
        }
      }
    }

    // Feature #2: Generate verification token & send email
    const token = crypto.randomBytes(32).toString("hex");
    registeredUser.emailVerificationToken = token;
    registeredUser.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await registeredUser.save();

    // Send verification email (non-blocking)
    sendVerificationEmail(registeredUser, token);

    req.login(registeredUser, (err) => {
      if (err) {
        return next(err);
      }
      // Track session & login activity
      recordLogin(registeredUser, req);
      trackSession(registeredUser, req);

      req.flash("success", "Welcome to RoamHaven! Please check your email to verify your account.");
      res.redirect("/verify-email");
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/signup");
  }
};

module.exports.renderLoginForm = (req, res) => {
  res.render("users/login.ejs");
};

module.exports.login = async (req, res) => {
  // Feature #8: Record login activity
  await recordLogin(req.user, req, true);
  // Feature #5: Track session
  await trackSession(req.user, req);

  req.flash("success", "Welcome back to RoamHaven!");
  let redirectUrl = res.locals.redirectUrl || "/listings";
  res.redirect(redirectUrl);
};

module.exports.logout = async (req, res, next) => {
  // Feature #5: Remove session tracking
  if (req.sessionID) {
    await UserSession.deleteOne({ sessionId: req.sessionID });
  }

  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "You are logged out!");
    res.redirect("/listings");
  });
};

// ==============================
// Feature #2: Email Verification
// ==============================

module.exports.renderVerifyEmail = (req, res) => {
  res.render("users/verify-email.ejs");
};

module.exports.verifyEmail = async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    req.flash("error", "Verification link is invalid or has expired.");
    return res.redirect("/verify-email");
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  req.flash("success", "Email verified successfully! 🎉");
  res.redirect("/listings");
};

module.exports.resendVerification = async (req, res) => {
  if (!req.user) {
    req.flash("error", "Please log in first.");
    return res.redirect("/login");
  }

  if (req.user.isEmailVerified) {
    req.flash("success", "Your email is already verified!");
    return res.redirect("/listings");
  }

  const token = crypto.randomBytes(32).toString("hex");
  req.user.emailVerificationToken = token;
  req.user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  await req.user.save();

  await sendVerificationEmail(req.user, token);
  req.flash("success", "Verification email sent! Check your inbox.");
  res.redirect("/verify-email");
};

// ==============================
// Feature #3: Forgot Password
// ==============================

module.exports.renderForgotPassword = (req, res) => {
  res.render("users/forgot-password.ejs");
};

module.exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    // Don't reveal whether email exists — always show success
    req.flash("success", "If an account with that email exists, we've sent a password reset link.");
    return res.redirect("/forgot-password");
  }

  // Google OAuth users can't reset password
  if (user.googleId && !user.hash) {
    req.flash("error", "This account uses Google Sign-In. Please log in with Google.");
    return res.redirect("/login");
  }

  const token = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  await user.save();

  await sendPasswordResetEmail(user, token);
  req.flash("success", "If an account with that email exists, we've sent a password reset link.");
  res.redirect("/forgot-password");
};

module.exports.renderResetPassword = async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    req.flash("error", "Password reset link is invalid or has expired.");
    return res.redirect("/forgot-password");
  }

  res.render("users/reset-password.ejs", { token });
};

module.exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    req.flash("error", "Passwords do not match.");
    return res.redirect(`/reset-password/${token}`);
  }

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    req.flash("error", "Password reset link is invalid or has expired.");
    return res.redirect("/forgot-password");
  }

  // Use passport-local-mongoose's setPassword method
  await user.setPassword(password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  req.flash("success", "Password has been reset successfully! You can now log in.");
  res.redirect("/login");
};

// ==============================
// Feature #5: Session Management
// ==============================

module.exports.renderSessions = async (req, res) => {
  const sessions = await UserSession.find({ userId: req.user._id }).sort({ lastActive: -1 });

  // Mark the current session
  const currentSessionId = req.sessionID;
  const sessionsWithCurrent = sessions.map((s) => ({
    ...s.toObject(),
    isCurrent: s.sessionId === currentSessionId,
  }));

  res.render("users/sessions.ejs", { sessions: sessionsWithCurrent });
};

module.exports.revokeSession = async (req, res) => {
  const { id } = req.params;
  const session = await UserSession.findById(id);

  if (!session || !session.userId.equals(req.user._id)) {
    req.flash("error", "Session not found.");
    return res.redirect("/account/sessions");
  }

  if (session.sessionId === req.sessionID) {
    req.flash("error", "You can't revoke your current session. Use logout instead.");
    return res.redirect("/account/sessions");
  }

  // Delete from MongoDB session store
  const mongoose = require("mongoose");
  const db = mongoose.connection.db;
  await db.collection("sessions").deleteOne({ _id: session.sessionId });

  // Delete from our tracking
  await UserSession.findByIdAndDelete(id);

  req.flash("success", "Session revoked successfully.");
  res.redirect("/account/sessions");
};

module.exports.revokeAllSessions = async (req, res) => {
  const currentSessionId = req.sessionID;

  // Get all sessions except current
  const sessionsToRevoke = await UserSession.find({
    userId: req.user._id,
    sessionId: { $ne: currentSessionId },
  });

  // Delete from MongoDB session store
  const mongoose = require("mongoose");
  const db = mongoose.connection.db;
  const sessionIds = sessionsToRevoke.map((s) => s.sessionId);
  if (sessionIds.length > 0) {
    await db.collection("sessions").deleteMany({ _id: { $in: sessionIds } });
  }

  // Delete from our tracking
  await UserSession.deleteMany({
    userId: req.user._id,
    sessionId: { $ne: currentSessionId },
  });

  req.flash("success", `${sessionsToRevoke.length} session(s) revoked.`);
  res.redirect("/account/sessions");
};

// ==============================
// Feature #8: Login Activity Log
// ==============================

module.exports.renderActivityLog = async (req, res) => {
  const user = await User.findById(req.user._id);
  // Reverse to show most recent first
  const loginHistory = [...(user.loginHistory || [])].reverse();
  res.render("users/activity.ejs", { loginHistory });
};

// ==============================
// Feature #156: Data Export (GDPR)
// ==============================

module.exports.exportData = async (req, res) => {
  const userId = req.user._id;

  const ownedListings = await Listing.find({ owner: userId }).select("_id");
  const ownedListingIds = ownedListings.map((l) => l._id);

  const [user, listings, guestBookings, hostBookings, reviews, wallet, payments, sessions] =
    await Promise.all([
      User.findById(userId).lean(),
      Listing.find({ owner: userId }).lean(),
      Booking.find({ user: userId }).lean(),
      // Previously this ran Booking.find({}) — a full, unfiltered scan of every
      // booking in the database on every export request — then filtered down to
      // this user's listings in JS. Scoped to owned listing IDs instead.
      ownedListingIds.length > 0
        ? Booking.find({ listing: { $in: ownedListingIds } }).lean()
        : Promise.resolve([]),
      Review.find({ author: userId }).lean(),
      Wallet.findOne({ user: userId }).lean(),
      Payment.find({ user: userId }).lean(),
      UserSession.find({ userId }).lean(),
    ]);

  const data = {
    exportedAt: new Date().toISOString(),
    user: user || null,
    listingsOwned: listings,
    bookingsAsGuest: guestBookings,
    bookingsAsHost: hostBookings,
    reviewsWritten: reviews,
    wallet: wallet || null,
    payments: payments,
    sessions: sessions,
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="roamhaven-data-' + userId + '.json"'
  );
  res.send(JSON.stringify(data, null, 2));
};

// ==============================
// Feature #144: Guest ID Verification
// ==============================

module.exports.renderGuestVerification = async (req, res) => {
  const user = await User.findById(req.user._id).select("idVerification");
  res.render("users/guest-verification.ejs", { verification: user.idVerification || null });
};

module.exports.uploadGuestVerification = async (req, res) => {
  if (!req.file) {
    req.flash("error", "Please upload a valid ID image.");
    return res.redirect("/account/verify-id");
  }

  await User.findByIdAndUpdate(req.user._id, {
    $set: {
      "idVerification.status": "pending",
      "idVerification.idImage.url": req.file.path,
      "idVerification.idImage.filename": req.file.filename,
      "idVerification.submittedAt": new Date(),
    },
  });

  req.flash("success", "ID submitted successfully. Verification is in progress.");
  res.redirect("/account/verify-id");
};

// ==============================
// Feature #49 + #51: Profile page + verification badges
// ==============================

module.exports.renderProfile = async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({ path: "favorites", select: "title image price location country" })
    .select("-hash -salt");
  res.render("users/profile.ejs", { profileUser: user, isSelf: true });
};

module.exports.updateProfile = async (req, res) => {
  const { bio, languages, phone } = req.body || {};
  const langList = String(languages || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);

  const update = {
    bio: (bio || "").toString().slice(0, 500),
    languages: langList,
    phone: (phone || "").toString().slice(0, 30),
  };

  if (req.file) {
    update["avatar.url"] = req.file.path;
    update["avatar.filename"] = req.file.filename;
  }

  await User.findByIdAndUpdate(req.user._id, { $set: update });
  req.flash("success", "Profile updated.");
  res.redirect("/profile");
};

module.exports.showPublicProfile = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new NotFoundError("User not found.");
  }
  // SECURITY: this route has no isLoggedIn guard — anyone can view any user's
  // profile. Only select fields that are safe to expose publicly. Previously
  // this also selected `email` and the full `idVerification` object (which
  // contains the uploaded government-ID image URL) — neither is rendered by
  // the current template, but there's no reason to have them in the response
  // object on a public endpoint at all.
  const user = await User.findById(id).select("username bio languages avatar isEmailVerified isPhoneVerified idVerification.status role createdAt loyaltyPoints badges");
  if (!user) {
    req.flash("error", "User not found.");
    return res.redirect("/listings");
  }
  res.render("users/profile.ejs", { profileUser: user, isSelf: req.user ? String(req.user._id) === String(user._id) : false });
};
