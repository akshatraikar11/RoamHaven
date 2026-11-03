const nodemailer = require("nodemailer");

// Create transporter — uses Gmail SMTP by default
// Set EMAIL_USER and EMAIL_PASS in .env
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify connection on startup (non-blocking)
transporter.verify((err) => {
  if (err) {
    console.log("⚠️  Email transporter not configured:", err.message);
    console.log("   Email features (verification, password reset) will use console fallback.");
  } else {
    console.log("📧 Email transporter ready");
  }
});

const APP_URL = process.env.APP_URL || "http://localhost:8080";

/**
 * Send email verification link
 */
module.exports.sendVerificationEmail = async (user, token) => {
  const verifyUrl = `${APP_URL}/verify-email/${token}`;

  const mailOptions = {
    from: `"RoamHaven" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: "Verify your RoamHaven account",
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #ff385c 0%, #e03a45 100%); padding: 32px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 700;">RoamHaven</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">Your next adventure awaits</p>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #222; margin: 0 0 16px;">Verify your email address</h2>
          <p style="color: #555; font-size: 15px; line-height: 1.6;">
            Hi <strong>${user.username}</strong>,<br>
            Thanks for signing up! Please verify your email to unlock all RoamHaven features.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}" style="background: #ff385c; color: #fff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
              Verify Email
            </a>
          </div>
          <p style="color: #888; font-size: 13px;">
            This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="color: #aaa; font-size: 12px; text-align: center;">
            Or copy this link: <br>
            <a href="${verifyUrl}" style="color: #ff385c; word-break: break-all;">${verifyUrl}</a>
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Verification email sent to ${user.email}`);
  } catch (err) {
    console.log(`📧 [CONSOLE FALLBACK] Verification link for ${user.email}:`);
    console.log(`   ${verifyUrl}`);
  }
};

/**
 * Send password reset link
 */
module.exports.sendPasswordResetEmail = async (user, token) => {
  const resetUrl = `${APP_URL}/reset-password/${token}`;

  const mailOptions = {
    from: `"RoamHaven" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: "Reset your RoamHaven password",
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #222 0%, #444 100%); padding: 32px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 700;">RoamHaven</h1>
          <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0;">Password Reset</p>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #222; margin: 0 0 16px;">Reset your password</h2>
          <p style="color: #555; font-size: 15px; line-height: 1.6;">
            Hi <strong>${user.username}</strong>,<br>
            We received a request to reset your password. Click the button below to create a new one.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="background: #222; color: #fff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #888; font-size: 13px;">
            This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email — your password won't be changed.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="color: #aaa; font-size: 12px; text-align: center;">
            Or copy this link: <br>
            <a href="${resetUrl}" style="color: #ff385c; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Password reset email sent to ${user.email}`);
  } catch (err) {
    console.log(`📧 [CONSOLE FALLBACK] Password reset link for ${user.email}:`);
    console.log(`   ${resetUrl}`);
  }
};

function safeEmailUser(userLike) {
  if (!userLike) return { email: null, username: "there" };
  return {
    email: userLike.email || null,
    username: userLike.username || "there",
  };
}

async function sendMailOrConsole({ to, subject, html, fallbackLines = [] }) {
  if (!to) return;
  const mailOptions = {
    from: `"RoamHaven" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.log(`📧 [CONSOLE FALLBACK] ${subject} → ${to}`);
    fallbackLines.forEach((l) => console.log(`   ${l}`));
  }
}

module.exports.sendBookingConfirmedEmail = async (userLike, booking, listing) => {
  const { email, username } = safeEmailUser(userLike);
  const link = `${APP_URL}/bookings/${booking._id}/success`;
  const title = listing?.title || "your stay";
  const amountRupees = Math.round((booking?.totalAmount || booking?.payment?.amount || 0) / 100);

  await sendMailOrConsole({
    to: email,
    subject: "Your RoamHaven booking is confirmed",
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="margin: 0 0 12px; color:#111;">Booking confirmed</h2>
        <p style="margin:0 0 16px; color:#444;">Hi <strong>${username}</strong>, your booking for <strong>${title}</strong> is confirmed.</p>
        <div style="padding:16px; border:1px solid #eee; border-radius:10px; background:#fafafa;">
          <div><strong>Booking ID:</strong> ${booking._id}</div>
          <div style="margin-top:6px;"><strong>Total:</strong> ₹${amountRupees.toLocaleString("en-IN")}</div>
        </div>
        <div style="margin-top:18px;">
          <a href="${link}" style="background:#ff385c; color:#fff; text-decoration:none; padding:12px 18px; border-radius:8px; display:inline-block; font-weight:600;">
            View booking
          </a>
        </div>
      </div>
    `,
    fallbackLines: [link],
  });
};

module.exports.sendBookingStatusEmail = async (userLike, booking, listing, status) => {
  const { email, username } = safeEmailUser(userLike);
  const link = `${APP_URL}/bookings/${booking._id}/success`;
  const title = listing?.title || "your booking";
  await sendMailOrConsole({
    to: email,
    subject: `Booking status updated: ${String(status || "").toUpperCase()}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="margin: 0 0 12px; color:#111;">Booking update</h2>
        <p style="margin:0 0 16px; color:#444;">Hi <strong>${username}</strong>, the status for <strong>${title}</strong> is now <strong>${status}</strong>.</p>
        <div style="margin-top:18px;">
          <a href="${link}" style="background:#ff385c; color:#fff; text-decoration:none; padding:12px 18px; border-radius:8px; display:inline-block; font-weight:600;">
            Open booking
          </a>
        </div>
      </div>
    `,
    fallbackLines: [link],
  });
};
