const express = require("express");
const router = express.Router({ mergeParams: true });
const User = require("../models/user.js");
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const { saveRedirectUrl, isLoggedIn } = require("../middleware.js");

const userController = require("../controllers/users.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });

// ==============================
// Signup & Login
// ==============================

router
  .route("/signup")
  .get(userController.renderSignupForm)
  .post(wrapAsync(userController.signup));

router
  .route("/login")
  .get(userController.renderLoginForm)
  .post(
    saveRedirectUrl,
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: true,
    }),
    wrapAsync(userController.login)
  );

router.get("/logout", wrapAsync(userController.logout));

// ==============================
// Google OAuth
// ==============================

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  async (req, res) => {
    // Auto-verify Google users & record login
    const UAParser = require("ua-parser-js");
    const UserSession = require("../models/session.js");

    if (!req.user.isEmailVerified) {
      req.user.isEmailVerified = true;
      await req.user.save();
    }

    // Record login activity
    const parser = new UAParser(req.headers["user-agent"]);
    const result = parser.getResult();
    req.user.loginHistory.push({
      ip: req.ip || "Unknown",
      device: result.device.model || result.device.type || "Desktop",
      browser: `${result.browser.name || "Unknown"} ${result.browser.version || ""}`.trim(),
      timestamp: new Date(),
      success: true,
    });
    await req.user.save();

    // Track session
    await UserSession.findOneAndUpdate(
      { sessionId: req.sessionID },
      {
        userId: req.user._id,
        sessionId: req.sessionID,
        ip: req.ip || "Unknown",
        device: result.device.model || result.device.type || "Desktop",
        browser: `${result.browser.name || "Unknown"} ${result.browser.version || ""}`.trim(),
        os: `${result.os.name || "Unknown"} ${result.os.version || ""}`.trim(),
        lastActive: new Date(),
      },
      { upsert: true, new: true }
    );

    req.flash("success", "Welcome back to RoamHaven!");
    res.redirect("/listings");
  }
);

// ==============================
// Feature #2: Email Verification
// ==============================

router.get("/verify-email", isLoggedIn, userController.renderVerifyEmail);
router.get("/verify-email/:token", wrapAsync(userController.verifyEmail));
router.post("/resend-verification", isLoggedIn, wrapAsync(userController.resendVerification));

// ==============================
// Feature #3: Forgot Password
// ==============================

router
  .route("/forgot-password")
  .get(userController.renderForgotPassword)
  .post(wrapAsync(userController.forgotPassword));

router
  .route("/reset-password/:token")
  .get(wrapAsync(userController.renderResetPassword))
  .post(wrapAsync(userController.resetPassword));

// ==============================
// Feature #5: Session Management
// ==============================

router.get("/account/sessions", isLoggedIn, wrapAsync(userController.renderSessions));
router.post("/account/sessions/:id/revoke", isLoggedIn, wrapAsync(userController.revokeSession));
router.post("/account/sessions/revoke-all", isLoggedIn, wrapAsync(userController.revokeAllSessions));

// ==============================
// Feature #8: Login Activity Log
// ==============================

router.get("/account/activity", isLoggedIn, wrapAsync(userController.renderActivityLog));

// ==============================
// Feature #156: Data Export (GDPR)
// ==============================

router.get("/account/export", isLoggedIn, wrapAsync(userController.exportData));

// Feature #144: guest verification via ID upload
router
  .route("/account/verify-id")
  .get(isLoggedIn, wrapAsync(userController.renderGuestVerification))
  .post(isLoggedIn, upload.single("idImage"), wrapAsync(userController.uploadGuestVerification));

// Feature #49: Profile
router
  .route("/profile")
  .get(isLoggedIn, wrapAsync(userController.renderProfile))
  .post(isLoggedIn, upload.single("avatar"), wrapAsync(userController.updateProfile));

router.get("/users/:id", wrapAsync(userController.showPublicProfile));

module.exports = router;
