const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Payment = require("../models/payment");
const Coupon = require("../models/coupon");
const Wallet = require("../models/wallet");
const User = require("../models/user");
const Notification = require("../models/notification");
const { createOrder, verifyPaymentSignature } = require("../utils/razorpay");
const { bumpNamespaceVersion } = require("../utils/cache");
const {
  sendBookingConfirmedEmail,
  sendBookingStatusEmail,
} = require("../utils/email");
const { emitAdminAnalytics } = require("../utils/analytics");

const COMMISSION_RATE = 0.1; // Feature #35
const SERVICE_FEE_RATE = 0.05; // Matches existing booking UI
const REFERRAL_REWARD_PAISE = 500 * 100; // Feature #57: ₹500

function calculateDynamicPrice(listing, checkInDate, checkOutDate) {
  const basePrice = listing.price;
  const weekendPrice = listing.weekendPrice || basePrice;
  const seasonalPricing = listing.seasonalPricing || [];

  if (!checkInDate || !checkOutDate) {
    return { nightlyPrice: basePrice, totalPrice: basePrice, nights: 1, breakdown: [] };
  }

  const start = new Date(checkInDate);
  const end = new Date(checkOutDate);
  const nights = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

  let totalPrice = 0;
  const breakdown = [];

  const demandMultiplier = Number(listing?.surgeMultiplier || 1);
  const shouldApplyDemand = demandMultiplier > 1;

  for (let i = 0; i < nights; i++) {
    const currentDate = new Date(start);
    currentDate.setDate(currentDate.getDate() + i);
    const dayOfWeek = currentDate.getDay(); // 0=Sun, 5=Fri, 6=Sat

    let nightPrice = basePrice;
    let priceType = "base";

    for (const season of seasonalPricing) {
      const sStart = new Date(season.startDate);
      const sEnd = new Date(season.endDate);
      if (currentDate >= sStart && currentDate <= sEnd) {
        nightPrice = season.price;
        priceType = season.name || "seasonal";
        break;
      }
    }

    if (priceType === "base" && (dayOfWeek === 5 || dayOfWeek === 6) && weekendPrice !== basePrice) {
      nightPrice = weekendPrice;
      priceType = "weekend";
    }

    if (shouldApplyDemand) {
      nightPrice = Math.round(nightPrice * demandMultiplier);
      if (priceType === "base") priceType = "surge";
      else priceType = `${priceType}+surge`;
    }

    totalPrice += nightPrice;
    breakdown.push({
      date: currentDate.toISOString().split("T")[0],
      price: nightPrice,
      type: priceType,
    });
  }

  const avgNightlyPrice = Math.round(totalPrice / nights);
  return { nightlyPrice: avgNightlyPrice, totalPrice, nights, breakdown };
}

function paiseToRupees(paise) {
  return Math.round(paise / 100);
}

function rupeesToPaise(rupees) {
  return Math.round(rupees * 100);
}

async function getOrCreateWallet(userId) {
  let wallet = await Wallet.findOne({ user: userId });
  if (wallet) return wallet;

  wallet = await Wallet.create({ user: userId, balance: 0, transactions: [] });
  await User.findByIdAndUpdate(userId, { $set: { wallet: wallet._id } });
  return wallet;
}

async function validateCouponAndCalculateDiscount({ couponCode, totalPaise }) {
  const code = (couponCode || "").toString().trim().toUpperCase();
  if (!code) return { coupon: null, discountPaise: 0 };

  const coupon = await Coupon.findOne({ code, isActive: true });
  if (!coupon) {
    return { coupon: null, discountPaise: 0, error: "Invalid or inactive coupon." };
  }
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= Date.now()) {
    return { coupon: null, discountPaise: 0, error: "Coupon has expired." };
  }
  if (typeof coupon.usageLimit === "number" && coupon.usedCount >= coupon.usageLimit) {
    return { coupon: null, discountPaise: 0, error: "Coupon usage limit reached." };
  }

  const totalRupees = paiseToRupees(totalPaise);
  if (totalRupees < (coupon.minBookingAmount || 0)) {
    return { coupon: null, discountPaise: 0, error: "Coupon minimum booking amount not met." };
  }

  let discountRupees = 0;
  if (coupon.discountType === "percentage") {
    discountRupees = Math.round((totalRupees * coupon.discountValue) / 100);
    if (coupon.maxDiscount) {
      discountRupees = Math.min(discountRupees, Math.round(coupon.maxDiscount));
    }
  } else {
    // flat in ₹
    discountRupees = Math.min(totalRupees, Math.round(coupon.discountValue));
  }

  const discountPaise = rupeesToPaise(discountRupees);
  if (discountPaise <= 0) return { coupon, discountPaise: 0 };

  return { coupon, discountPaise };
}

function computeAmountForListing({ listing, startDate, endDate }) {
  const priceInfo = calculateDynamicPrice(listing, startDate, endDate);

  // subtotal is dynamic price (rooms), in rupees
  const subtotalRupees = Math.round(priceInfo.totalPrice);
  const serviceFeeRupees = Math.round(subtotalRupees * SERVICE_FEE_RATE);
  const cleaningFeeRupees = 0;
  const taxesRupees = 0;
  const totalRupees = subtotalRupees + serviceFeeRupees + cleaningFeeRupees + taxesRupees;

  return {
    priceInfo,
    subtotalPaise: rupeesToPaise(subtotalRupees),
    serviceFeePaise: rupeesToPaise(serviceFeeRupees),
    cleaningFeePaise: rupeesToPaise(cleaningFeeRupees),
    taxesPaise: rupeesToPaise(taxesRupees),
    totalPaise: rupeesToPaise(totalRupees),
  };
}

function pushStatusHistory(booking, { status, by, note }) {
  booking.statusHistory = booking.statusHistory || [];
  booking.statusHistory.push({
    status,
    at: new Date(),
    by,
    note: note || "",
  });
}

async function createNotification({ userId, type, title, message, link }) {
  if (!userId) return null;
  const notif = await Notification.create({
    user: userId,
    type,
    title: title || "",
    message: message || "",
    link: link || "",
  });

  return notif;
}

function emitRealtimeNotification(req, userId, payload) {
  try {
    const io = req.app?.locals?.io;
    if (!io || !userId) return;
    io.to(`user:${String(userId)}`).emit("notification:new", payload);
  } catch (e) {
    // non-fatal
  }
}

async function tryApplyReferralReward(userId) {
  const user = await User.findById(userId).select("referredByCode referralRewarded wallet");
  if (!user) return;
  if (!user.referredByCode || user.referralRewarded) return;

  const referrer = await User.findOne({ referralCode: user.referredByCode }).select("_id wallet");
  if (!referrer) return;

  const guestWallet = await getOrCreateWallet(user._id);
  const refWallet = await getOrCreateWallet(referrer._id);

  guestWallet.balance += REFERRAL_REWARD_PAISE;
  guestWallet.transactions.push({
    type: "credit",
    amount: REFERRAL_REWARD_PAISE,
    description: "Referral reward credited",
    reference: user._id,
  });

  refWallet.balance += REFERRAL_REWARD_PAISE;
  refWallet.transactions.push({
    type: "credit",
    amount: REFERRAL_REWARD_PAISE,
    description: "Referral reward credited",
    reference: user._id,
  });

  await Promise.all([guestWallet.save(), refWallet.save()]);
  user.referralRewarded = true;
  await user.save();
}

async function invalidateBookingDrivenListingCaches() {
  await Promise.all([
    bumpNamespaceVersion("listing:analytics"),
    bumpNamespaceVersion("listing:insights"),
  ]);
}

async function awardLoyaltyAndBadges(userId, bookingAmountPaise) {
  const user = await User.findById(userId);
  if (!user) return;

  const earnedPoints = Math.max(10, Math.floor((bookingAmountPaise || 0) / 1000));
  user.loyaltyPoints = (user.loyaltyPoints || 0) + earnedPoints;

  const totalBookings = await Booking.countDocuments({ user: userId, status: "confirmed" });
  const existingBadges = new Set((user.badges || []).map((b) => b.key));
  const addBadge = (key, label) => {
    if (!existingBadges.has(key)) user.badges.push({ key, label, earnedAt: new Date() });
  };

  if (totalBookings >= 1) addBadge("first_booking", "First Journey");
  if (totalBookings >= 5) addBadge("explorer", "Explorer");
  if (totalBookings >= 10) addBadge("globe_trotter", "Globe Trotter");
  if (user.idVerification?.status === "verified") addBadge("verified_guest", "Verified Guest");

  await user.save();
}

module.exports.renderBookingForm = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id).populate("owner");

  if (!listing) {
    req.flash("error", "Listing not found");
    return res.redirect("/listings");
  }

  const wallet = await getOrCreateWallet(req.user._id);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 3);

  let startDate = tomorrow;
  let endDate = dayAfter;

  if (req.query.startDate) {
    const parsedStart = new Date(req.query.startDate);
    if (!Number.isNaN(parsedStart.getTime())) startDate = parsedStart;
  }
  if (req.query.endDate) {
    const parsedEnd = new Date(req.query.endDate);
    if (!Number.isNaN(parsedEnd.getTime())) endDate = parsedEnd;
  }
  if (endDate <= startDate) {
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 2);
  }

  const totals = computeAmountForListing({
    listing,
    startDate,
    endDate,
  });

  res.render("bookings/new", {
    listing,
    walletBalancePaise: wallet.balance,
    defaults: {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    },
    price: {
      subtotalPaise: totals.subtotalPaise,
      serviceFeePaise: totals.serviceFeePaise,
      cleaningFeePaise: totals.cleaningFeePaise,
      taxesPaise: totals.taxesPaise,
      totalPaise: totals.totalPaise,
    },
  });
};

// AJAX endpoint: validate coupon and return discount calculation
module.exports.applyCoupon = async (req, res) => {
  const { listingId, startDate, endDate, couponCode } = req.body || {};

  try {
    const listing = await Listing.findById(listingId).select("price weekendPrice seasonalPricing");
    if (!listing) return res.status(404).json({ success: false, error: "Listing not found." });

    const totals = computeAmountForListing({ listing, startDate, endDate });
    const { coupon, discountPaise, error } = await validateCouponAndCalculateDiscount({
      couponCode,
      totalPaise: totals.totalPaise,
    });

    if (error) return res.status(400).json({ success: false, error });

    return res.json({
      success: true,
      coupon: coupon ? { id: coupon._id, code: coupon.code } : null,
      discountPaise,
      totalAfterDiscountPaise: Math.max(0, totals.totalPaise - discountPaise),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to apply coupon." });
  }
};

module.exports.createOrder = async (req, res) => {
  const {
    listingId,
    startDate,
    endDate,
    name,
    mobile,
    email,
    couponCode,
    useWallet,
    message,
  } = req.body || {};

  try {
    const listing = await Listing.findById(listingId).populate("owner");
    if (!listing) return res.status(404).json({ success: false, error: "Listing not found." });
    if (!req.user) return res.status(401).json({ success: false, error: "Not authenticated." });

    const totals = computeAmountForListing({ listing, startDate, endDate });
    const couponResult = await validateCouponAndCalculateDiscount({
      couponCode,
      totalPaise: totals.totalPaise,
    });

    if (couponResult.error) {
      return res.status(400).json({ success: false, error: couponResult.error });
    }

    const discountPaise = couponResult.discountPaise || 0;
    const totalAfterDiscountPaise = Math.max(0, totals.totalPaise - discountPaise);

    const wallet = await getOrCreateWallet(req.user._id);
    const walletUsedPaise = useWallet ? Math.min(wallet.balance, totalAfterDiscountPaise) : 0;
    const gatewayAmountPaise = Math.max(0, totalAfterDiscountPaise - walletUsedPaise);

    const platformFeePaise = Math.round(totalAfterDiscountPaise * COMMISSION_RATE);
    const hostPayoutPaise = Math.max(0, totalAfterDiscountPaise - platformFeePaise);

    // Create booking in "pending" state before redirecting to Razorpay
    const booking = await Booking.create({
      listing: listingId,
      user: req.user._id,
      name,
      mobile,
      email,
      message: (message || "").toString().slice(0, 2000),
      startDate,
      endDate,
      status: "pending",
      totalAmount: totalAfterDiscountPaise,
      couponApplied: couponResult.coupon ? couponResult.coupon._id : undefined,
      walletUsed: walletUsedPaise,
      gatewayAmount: gatewayAmountPaise,
      pricing: {
        currency: "INR",
        nights: totals.priceInfo?.nights || 1,
        subtotal: totals.subtotalPaise,
        serviceFee: totals.serviceFeePaise,
        cleaningFee: totals.cleaningFeePaise,
        taxes: totals.taxesPaise,
        totalBeforeDiscount: totals.totalPaise,
        discount: discountPaise,
        totalAfterDiscount: totalAfterDiscountPaise,
        nightlyBreakdown: (totals.priceInfo?.breakdown || []).map((b) => ({
          date: b.date,
          priceRupees: b.price,
          type: b.type,
        })),
      },
    });
    pushStatusHistory(booking, { status: "pending", by: req.user._id, note: "Booking created" });
    await booking.save();

    const payment = await Payment.create({
      booking: booking._id,
      user: req.user._id,
      listing: listingId,
      razorpayOrderId: undefined,
      razorpayPaymentId: undefined,
      razorpaySignature: undefined,
      amount: totalAfterDiscountPaise,
      status: gatewayAmountPaise > 0 ? "created" : "paid",
      couponUsed: couponResult.coupon ? couponResult.coupon._id : undefined,
      discount: discountPaise,
      platformFee: platformFeePaise,
      hostPayout: hostPayoutPaise,
      walletUsed: walletUsedPaise,
      gatewayAmount: gatewayAmountPaise,
      createdAt: new Date(),
    });

    booking.payment = payment._id;
    await booking.save();
    await invalidateBookingDrivenListingCaches();

    const hostUserId = listing.owner?._id;
    if (!hostUserId) {
      return res.status(400).json({ success: false, error: "Listing owner not found." });
    }

    // Wallet-only checkout (no Razorpay order)
    if (gatewayAmountPaise <= 0) {
      // Debits/credits must happen only once.
      if (payment.status !== "paid") {
        await payment.updateOne({ status: "paid" });
      }

      const guestWallet = await getOrCreateWallet(req.user._id);
      if (guestWallet.balance < walletUsedPaise) {
        return res.status(400).json({ success: false, error: "Insufficient wallet balance." });
      }

      guestWallet.balance -= walletUsedPaise;
      guestWallet.transactions.push({
        type: "debit",
        amount: walletUsedPaise,
        description: `Booking payment debited (Booking: ${booking._id})`,
        reference: payment._id,
      });
      await guestWallet.save();

      const hostWallet = await getOrCreateWallet(hostUserId);
      hostWallet.balance += hostPayoutPaise;
      hostWallet.transactions.push({
        type: "credit",
        amount: hostPayoutPaise,
        description: `Host payout credited (Booking: ${booking._id})`,
        reference: payment._id,
      });
      await hostWallet.save();

      if (couponResult.coupon) {
        await Coupon.findByIdAndUpdate(couponResult.coupon._id, {
          $inc: { usedCount: 1 },
        });
      }

      booking.status = "confirmed";
      pushStatusHistory(booking, { status: "confirmed", by: req.user._id, note: "Wallet payment completed" });
      await booking.save();
      await invalidateBookingDrivenListingCaches();
      await awardLoyaltyAndBadges(req.user._id, totalAfterDiscountPaise);
      await tryApplyReferralReward(req.user._id);

      await createNotification({
        userId: req.user._id,
        type: "booking_confirmed",
        title: "Booking confirmed",
        message: `Your booking for "${listing.title}" is confirmed.`,
        link: `/bookings/${booking._id}/success`,
      });
      await createNotification({
        userId: hostUserId,
        type: "booking_confirmed_host",
        title: "New booking confirmed",
        message: `A booking for "${listing.title}" was confirmed.`,
        link: `/bookings/host`,
      });

      emitRealtimeNotification(req, req.user._id, { type: "booking_confirmed", link: `/bookings/${booking._id}/success` });
      emitRealtimeNotification(req, hostUserId, { type: "booking_confirmed_host", link: `/bookings/host` });

      sendBookingConfirmedEmail(req.user, booking, listing).catch(() => {});
      sendBookingStatusEmail(listing.owner, booking, listing, "confirmed").catch(() => {});

      return res.json({
        success: true,
        redirectUrl: `/bookings/${booking._id}/success`,
      });
    }

    // Create Razorpay order for the gateway portion only
    const order = await createOrder({
      amountPaise: gatewayAmountPaise,
      currency: "INR",
      receipt: `booking_${booking._id}`,
    });

    await payment.updateOne({
      razorpayOrderId: order.id,
      status: "created",
      gatewayAmount: gatewayAmountPaise,
    });

    return res.json({
      success: true,
      orderId: order.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      bookingId: booking._id,
      amountPaise: gatewayAmountPaise,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Failed to create payment order." });
  }
};

module.exports.verifyPayment = async (req, res) => {
  const {
    bookingId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body || {};

  try {
    const booking = await Booking.findById(bookingId).populate("listing");
    if (!booking || !booking.user.equals(req.user._id)) {
      return res.status(404).json({ success: false, error: "Booking not found." });
    }

    const payment = await Payment.findById(booking.payment);
    if (!payment) return res.status(404).json({ success: false, error: "Payment not found." });

    if (payment.status === "paid") {
      return res.json({ success: true, redirectUrl: `/bookings/${booking._id}/success` });
    }

    if (payment.razorpayOrderId && payment.razorpayOrderId.toString() !== razorpay_order_id?.toString()) {
      return res.status(400).json({ success: false, error: "Payment order mismatch." });
    }

    const isValid = verifyPaymentSignature({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    if (!isValid) {
      await payment.updateOne({ status: "failed" });
      await booking.updateOne({ status: "pending" });
      return res.status(400).json({ success: false, error: "Payment signature verification failed." });
    }

    const hostUserId = booking.listing?.owner;

    // Wallet debit for walletUsed (if any) - resolved BEFORE marking payment/booking as
    // paid/confirmed, so a partial-wallet failure never leaves the booking in a confirmed
    // state that has to be walked back. (Previously this block ran twice and flipped the
    // booking to "confirmed" before this check, then again after — duplicate writes and a
    // premature-confirmation window. Fixed to run once, in the correct order.)
    if (payment.walletUsed > 0) {
      const guestWallet = await getOrCreateWallet(req.user._id);
      if (guestWallet.balance < payment.walletUsed) {
        await payment.updateOne({ status: "failed" });
        await booking.updateOne({ status: "pending" });
        return res.status(400).json({ success: false, error: "Insufficient wallet balance at verification time." });
      }

      guestWallet.balance -= payment.walletUsed;
      guestWallet.transactions.push({
        type: "debit",
        amount: payment.walletUsed,
        description: `Booking payment debited (Booking: ${booking._id})`,
        reference: payment._id,
      });
      await guestWallet.save();
    }

    // Update payment as paid (only after any wallet debit has succeeded)
    payment.razorpayOrderId = razorpay_order_id;
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = "paid";
    await payment.save();

    // Confirm booking
    booking.status = "confirmed";
    pushStatusHistory(booking, { status: "confirmed", by: req.user._id, note: "Payment verified" });
    await booking.save();
    await invalidateBookingDrivenListingCaches();

    // Credit host wallet payout (Feature #35 split)
    if (hostUserId) {
      const hostWallet = await getOrCreateWallet(hostUserId);
      hostWallet.balance += payment.hostPayout;
      hostWallet.transactions.push({
        type: "credit",
        amount: payment.hostPayout,
        description: `Host payout credited (Booking: ${booking._id})`,
        reference: payment._id,
      });
      await hostWallet.save();
    }

    // Coupon usage count increment on successful payment
    if (payment.couponUsed) {
      await Coupon.findByIdAndUpdate(payment.couponUsed, { $inc: { usedCount: 1 } });
    }
    await awardLoyaltyAndBadges(req.user._id, payment.amount);
    await tryApplyReferralReward(req.user._id);

    const listing = await Listing.findById(booking.listing).populate("owner");
    const hostUserIdForNotify = listing?.owner?._id || listing?.owner;

    await createNotification({
      userId: req.user._id,
      type: "booking_confirmed",
      title: "Booking confirmed",
      message: `Your booking for "${listing?.title || "listing"}" is confirmed.`,
      link: `/bookings/${booking._id}/success`,
    });
    if (hostUserIdForNotify) {
      await createNotification({
        userId: hostUserIdForNotify,
        type: "booking_confirmed_host",
        title: "New booking confirmed",
        message: `A booking for "${listing?.title || "listing"}" was confirmed.`,
        link: `/bookings/host`,
      });
    }
    emitRealtimeNotification(req, req.user._id, { type: "booking_confirmed", link: `/bookings/${booking._id}/success` });
    emitRealtimeNotification(req, hostUserIdForNotify, { type: "booking_confirmed_host", link: `/bookings/host` });

    sendBookingConfirmedEmail(req.user, booking, listing).catch(() => {});
    sendBookingStatusEmail(listing?.owner, booking, listing, "confirmed").catch(() => {});
    emitAdminAnalytics(req.app?.locals?.io).catch(() => {});

    return res.json({ success: true, redirectUrl: `/bookings/${booking._id}/success` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Failed to verify payment." });
  }
};

module.exports.paymentHistory = async (req, res) => {
  const payments = await Payment.find({ user: req.user._id })
    .populate("listing", "title image")
    .populate("couponUsed", "code")
    .sort({ createdAt: -1 })
    .limit(50);

  res.render("bookings/history", { payments });
};

module.exports.refundBooking = async (req, res) => {
  const { id } = req.params;

  try {
    const booking = await Booking.findById(id).populate("listing").populate("payment");
    if (!booking || !booking.user.equals(req.user._id)) {
      req.flash("error", "Booking not found.");
      return res.redirect("/bookings/history");
    }

    if (booking.status !== "confirmed" || !booking.payment) {
      req.flash("error", "Refund not available for this booking.");
      return res.redirect("/bookings/history");
    }

    if (booking.payment.status === "refunded") {
      req.flash("success", "This booking has already been refunded.");
      return res.redirect("/bookings/history");
    }

    const payment = booking.payment;
    const refundPaise = payment.amount;
    const hostUserId = booking.listing?.owner;

    // Mark booking + payment as cancelled/refunded
    booking.status = "cancelled";
    pushStatusHistory(booking, { status: "cancelled", by: req.user._id, note: "Refund requested" });
    await booking.save();
    await invalidateBookingDrivenListingCaches();

    payment.status = "refunded";
    await payment.save();

    const guestWallet = await getOrCreateWallet(req.user._id);
    guestWallet.balance += refundPaise;
    guestWallet.transactions.push({
      type: "credit",
      amount: refundPaise,
      description: `Booking refund credited (Booking: ${booking._id})`,
      reference: payment._id,
    });
    await guestWallet.save();

    // Reverse host payout to keep ledgers consistent
    if (hostUserId) {
      const hostWallet = await getOrCreateWallet(hostUserId);
      hostWallet.balance -= payment.hostPayout;
      hostWallet.transactions.push({
        type: "debit",
        amount: payment.hostPayout,
        description: `Host payout reversed due to refund (Booking: ${booking._id})`,
        reference: payment._id,
      });
      await hostWallet.save();
    }

    req.flash("success", "Refund processed. Credited to your wallet.");
    return res.redirect("/bookings/history");
  } catch (err) {
    console.error(err);
    req.flash("error", "Refund failed.");
    return res.redirect("/bookings/history");
  }
};

module.exports.bookingSuccess = async (req, res) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate("listing", "title image")
    .populate("payment");

  if (!booking) {
    req.flash("error", "Booking not found.");
    return res.redirect("/listings");
  }

  if (!booking.user.equals(req.user._id)) {
    req.flash("error", "Not authorized.");
    return res.redirect("/listings");
  }

  res.render("bookings/success", { booking });
};

// Feature #33: booking history (guest)
module.exports.guestBookings = async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id })
    .populate("listing", "title image owner location country")
    .populate("payment")
    .sort({ createdAt: -1 })
    .limit(100);

  res.render("bookings/my.ejs", { bookings, mode: "guest" });
};

// Feature #33: booking history (host)
module.exports.hostBookings = async (req, res) => {
  const ownedListings = await Listing.find({ owner: req.user._id }).select("_id");
  const listingIds = ownedListings.map((l) => l._id);

  const bookings = await Booking.find({ listing: { $in: listingIds } })
    .populate("listing", "title image owner location country")
    .populate("user", "username email")
    .populate("payment")
    .sort({ createdAt: -1 })
    .limit(200);

  res.render("bookings/my.ejs", { bookings, mode: "host" });
};

// Feature #25: booking status workflow update (host or guest for cancel)
module.exports.updateBookingStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const nextStatus = String(status || "").trim();

  const booking = await Booking.findById(id).populate("listing");
  if (!booking) {
    req.flash("error", "Booking not found.");
    return res.redirect("/bookings/my");
  }

  const isGuest = booking.user?.equals(req.user._id);
  const isHost = booking.listing?.owner?.equals(req.user._id);
  const isAdmin = req.user.role === "admin";

  if (!isGuest && !isHost && !isAdmin) {
    req.flash("error", "Not authorized.");
    return res.redirect("/bookings/my");
  }

  const allowedStatuses = new Set(["pending", "confirmed", "checked_in", "completed", "cancelled"]);
  if (!allowedStatuses.has(nextStatus)) {
    req.flash("error", "Invalid status.");
    return res.redirect(isHost ? "/bookings/host" : "/bookings/my");
  }

  // Basic state machine
  const current = booking.status;
  const allowedTransitions = {
    pending: new Set(["cancelled"]),
    confirmed: new Set(["checked_in", "cancelled"]),
    checked_in: new Set(["completed"]),
    completed: new Set([]),
    cancelled: new Set([]),
  };

  const canMove = allowedTransitions[current]?.has(nextStatus);
  if (!canMove && nextStatus !== current) {
    req.flash("error", `Cannot move booking from "${current}" to "${nextStatus}".`);
    return res.redirect(isHost ? "/bookings/host" : "/bookings/my");
  }

  // Guests may only cancel their own bookings.
  if (isGuest && !isHost && !isAdmin && nextStatus !== "cancelled") {
    req.flash("error", "You can only cancel your booking.");
    return res.redirect("/bookings/my");
  }

  booking.status = nextStatus;
  pushStatusHistory(booking, { status: nextStatus, by: req.user._id, note: "Status updated" });
  await booking.save();
  await invalidateBookingDrivenListingCaches();

  // Notify counterpart
  const listing = booking.listing;
  const hostUserId = listing?.owner;

  if (nextStatus === "confirmed") {
    await createNotification({
      userId: booking.user,
      type: "booking_confirmed",
      title: "Booking confirmed",
      message: `Your booking for "${listing?.title || "listing"}" is confirmed.`,
      link: `/bookings/${booking._id}/success`,
    });
    if (hostUserId) {
      await createNotification({
        userId: hostUserId,
        type: "booking_confirmed_host",
        title: "Booking confirmed",
        message: `A booking for "${listing?.title || "listing"}" is confirmed.`,
        link: `/bookings/host`,
      });
    }
  } else {
    // generic status update
    if (booking.user) {
      await createNotification({
        userId: booking.user,
        type: "booking_status",
        title: "Booking updated",
        message: `Status changed to "${nextStatus}" for "${listing?.title || "listing"}".`,
        link: `/bookings/${booking._id}/success`,
      });
    }
    if (hostUserId) {
      await createNotification({
        userId: hostUserId,
        type: "booking_status_host",
        title: "Booking updated",
        message: `Status changed to "${nextStatus}" for "${listing?.title || "listing"}".`,
        link: `/bookings/host`,
      });
    }
  }

  emitRealtimeNotification(req, booking.user, { type: "booking_status", status: nextStatus, link: `/bookings/${booking._id}/success` });
  emitRealtimeNotification(req, hostUserId, { type: "booking_status_host", status: nextStatus, link: `/bookings/host` });

  // Email counterpart
  const hostUser = hostUserId ? await User.findById(hostUserId).select("email username") : null;
  const guestUser = await User.findById(booking.user).select("email username");
  sendBookingStatusEmail(guestUser, booking, listing, nextStatus).catch(() => {});
  if (hostUser) sendBookingStatusEmail(hostUser, booking, listing, nextStatus).catch(() => {});

  req.flash("success", `Booking status updated to "${nextStatus}".`);
  return res.redirect(isHost || isAdmin ? "/bookings/host" : "/bookings/my");
};

// Feature #32: Booking receipt (PDF)
module.exports.downloadReceiptPdf = async (req, res) => {
  const { id } = req.params;
  const booking = await Booking.findById(id)
    .populate("listing", "title location country owner")
    .populate("payment");

  if (!booking) {
    req.flash("error", "Booking not found.");
    return res.redirect("/bookings/my");
  }

  const isGuest = booking.user?.equals(req.user._id);
  const isHost = booking.listing?.owner?.equals(req.user._id);
  const isAdmin = req.user.role === "admin";
  if (!isGuest && !isHost && !isAdmin) {
    req.flash("error", "Not authorized.");
    return res.redirect("/bookings/my");
  }

  const PDFDocument = require("pdfkit");
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="roamhaven-receipt-${booking._id}.pdf"`
  );

  doc.pipe(res);

  doc.fontSize(22).text("RoamHaven Booking Receipt", { align: "left" });
  doc.moveDown(0.6);
  doc.fontSize(10).fillColor("#666").text(`Receipt generated: ${new Date().toLocaleString("en-IN")}`);
  doc.moveDown();

  doc.fillColor("#111").fontSize(12);
  doc.text(`Booking ID: ${booking._id}`);
  doc.text(`Status: ${booking.status}`);
  doc.text(`Listing: ${booking.listing?.title || ""}`);
  doc.text(`Location: ${(booking.listing?.location || "")} ${(booking.listing?.country || "")}`.trim());
  doc.text(`Dates: ${new Date(booking.startDate).toLocaleDateString("en-IN")} → ${new Date(booking.endDate).toLocaleDateString("en-IN")}`);
  doc.moveDown();

  const p = booking.pricing || {};
  const rupees = (paise) => `₹${Math.round((paise || 0) / 100).toLocaleString("en-IN")}`;

  doc.fontSize(14).text("Price breakdown");
  doc.moveDown(0.4);
  doc.fontSize(12);
  doc.text(`Subtotal: ${rupees(p.subtotal)}`);
  doc.text(`Service fee: ${rupees(p.serviceFee)}`);
  if (p.cleaningFee) doc.text(`Cleaning fee: ${rupees(p.cleaningFee)}`);
  if (p.taxes) doc.text(`Taxes: ${rupees(p.taxes)}`);
  doc.text(`Total before discount: ${rupees(p.totalBeforeDiscount)}`);
  if (p.discount) doc.text(`Discount: -${rupees(p.discount)}`);
  doc.moveDown(0.3);
  doc.fontSize(13).text(`Total paid: ${rupees(booking.totalAmount || booking.payment?.amount)}`, { underline: true });

  doc.moveDown();
  doc.fontSize(10).fillColor("#666").text("Thank you for booking with RoamHaven.");

  doc.end();
};

// Legacy fallback: if the old booking form is ever submitted,
// create a wallet-only payment placeholder so the app doesn't crash.
module.exports.createBooking = async (req, res) => {
  const { listingId, name, mobile, email, startDate, endDate } = req.body;
  const listing = await Listing.findById(listingId);
  if (!listing) return res.redirect("/listings");

  // Treat as "pending" booking without payments (keeps backwards compatibility)
  await Booking.create({
    listing: listingId,
    user: req.user._id,
    name,
    mobile,
    email,
    startDate,
    endDate,
    status: "pending",
  });
  await invalidateBookingDrivenListingCaches();

  req.flash("success", "Booking request received. Please complete payment from the booking page.");
  res.redirect(`/listings/${listingId}`);
};

// Feature #150: Shareable trip card endpoint (simple OG-ready card)
module.exports.shareTripCard = async (req, res) => {
  const { listingId } = req.query;
  const listing = await Listing.findById(listingId);
  if (!listing) {
    return res.status(404).send("Listing not found");
  }
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="g" x1="0%" x2="100%" y1="0%" y2="100%">
      <stop offset="0%" stop-color="#ff385c"/>
      <stop offset="100%" stop-color="#d70466"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="56" y="56" width="1088" height="518" rx="24" fill="white" fill-opacity="0.96"/>
  <text x="96" y="170" font-size="42" font-family="Arial, sans-serif" fill="#222" font-weight="700">RoamHaven Trip Card</text>
  <text x="96" y="245" font-size="52" font-family="Arial, sans-serif" fill="#111" font-weight="800">${String(listing.title).slice(0, 48)}</text>
  <text x="96" y="305" font-size="30" font-family="Arial, sans-serif" fill="#555">${String(listing.location || "")}, ${String(listing.country || "")}</text>
  <text x="96" y="390" font-size="44" font-family="Arial, sans-serif" fill="#ff385c" font-weight="800">₹${Number(listing.price || 0).toLocaleString("en-IN")} / night</text>
  <text x="96" y="520" font-size="28" font-family="Arial, sans-serif" fill="#444">Book now at RoamHaven</text>
</svg>`;
  res.setHeader("Content-Type", "image/svg+xml");
  res.send(svg);
};


// System Design: Self-Hosted Direct UPI Gateway (0% Gateway Fee, NPCI Compliant)
const { generateUpiIntentUri, generateUpiQrSvg, validateUtr } = require("../utils/upi");

module.exports.createUpiOrder = async (req, res) => {
  const { listingId, startDate, endDate, name, mobile, email, couponCode, useWallet, message } = req.body || {};
  try {
    const listing = await Listing.findById(listingId).populate("owner");
    if (!listing) return res.status(404).json({ success: false, error: "Listing not found." });
    if (!req.user) return res.status(401).json({ success: false, error: "Not authenticated." });

    const totals = computeAmountForListing({ listing, startDate, endDate });
    const couponResult = await validateCouponAndCalculateDiscount({ couponCode, totalPaise: totals.totalPaise });
    if (couponResult.error) return res.status(400).json({ success: false, error: couponResult.error });

    const discountPaise = couponResult.discountPaise || 0;
    const totalAfterDiscountPaise = Math.max(0, totals.totalPaise - discountPaise);
    const wallet = await getOrCreateWallet(req.user._id);
    const walletUsedPaise = useWallet ? Math.min(wallet.balance, totalAfterDiscountPaise) : 0;
    const upiPayablePaise = Math.max(0, totalAfterDiscountPaise - walletUsedPaise);
    const upiPayableRupees = paiseToRupees(upiPayablePaise);

    const platformFeePaise = Math.round(totalAfterDiscountPaise * COMMISSION_RATE);
    const hostPayoutPaise = Math.max(0, totalAfterDiscountPaise - platformFeePaise);

    const booking = await Booking.create({
      listing: listingId,
      user: req.user._id,
      name,
      mobile,
      email,
      message: (message || "").toString().slice(0, 2000),
      startDate,
      endDate,
      status: "pending",
      totalAmount: totalAfterDiscountPaise,
      couponApplied: couponResult.coupon ? couponResult.coupon._id : undefined,
      walletUsed: walletUsedPaise,
      gatewayAmount: upiPayablePaise,
      pricing: {
        currency: "INR",
        nights: totals.priceInfo?.nights || 1,
        subtotal: totals.subtotalPaise,
        serviceFee: totals.serviceFeePaise,
        cleaningFee: totals.cleaningFeePaise,
        taxes: totals.taxesPaise,
        totalBeforeDiscount: totals.totalPaise,
        discount: discountPaise,
        totalAfterDiscount: totalAfterDiscountPaise,
      },
    });
    pushStatusHistory(booking, { status: "pending", by: req.user._id, note: "UPI order initiated" });
    await booking.save();

    const payment = await Payment.create({
      booking: booking._id,
      user: req.user._id,
      listing: listingId,
      amount: totalAfterDiscountPaise,
      status: "created",
      paymentMethod: "upi",
      couponUsed: couponResult.coupon ? couponResult.coupon._id : undefined,
      discount: discountPaise,
      platformFee: platformFeePaise,
      hostPayout: hostPayoutPaise,
      walletUsed: walletUsedPaise,
      gatewayAmount: upiPayablePaise,
      createdAt: new Date(),
    });

    booking.payment = payment._id;
    await booking.save();

    const upiUri = generateUpiIntentUri({
      amountRupees: upiPayableRupees,
      referenceId: booking._id.toString(),
      transactionNote: "Stay-" + listing.title.slice(0, 20),
    });
    const qrData = generateUpiQrSvg(upiUri, 280);

    return res.json({
      success: true,
      bookingId: booking._id,
      amountRupees: upiPayableRupees,
      upiUri,
      qrImageUrl: qrData.qrImageUrl,
      vpa: qrData.vpa,
      payeeName: qrData.payeeName,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Failed to generate UPI order." });
  }
};

module.exports.verifyUpiPayment = async (req, res) => {
  const { bookingId, utrNumber } = req.body || {};
  try {
    if (!validateUtr(utrNumber)) {
      return res.status(400).json({ success: false, error: "Invalid 12-digit UPI UTR number." });
    }

    const booking = await Booking.findById(bookingId).populate("listing");
    if (!booking || !booking.user.equals(req.user._id)) {
      return res.status(404).json({ success: false, error: "Booking not found." });
    }

    const payment = await Payment.findById(booking.payment);
    if (!payment) return res.status(404).json({ success: false, error: "Payment not found." });

    if (payment.status === "paid") {
      return res.json({ success: true, redirectUrl: "/bookings/" + booking._id + "/success" });
    }

    if (payment.walletUsed > 0) {
      const guestWallet = await getOrCreateWallet(req.user._id);
      if (guestWallet.balance >= payment.walletUsed) {
        guestWallet.balance -= payment.walletUsed;
        guestWallet.transactions.push({
          type: "debit",
          amount: payment.walletUsed,
          description: "Booking partial wallet debit (Booking: " + booking._id + ")",
          reference: payment._id,
        });
        await guestWallet.save();
      }
    }

    payment.upiUtr = utrNumber.trim();
    payment.status = "paid";
    await payment.save();

    booking.status = "confirmed";
    pushStatusHistory(booking, { status: "confirmed", by: req.user._id, note: "UPI verified via UTR: " + utrNumber });
    await booking.save();
    await invalidateBookingDrivenListingCaches();
    await awardLoyaltyAndBadges(req.user._id, payment.amount);

    return res.json({
      success: true,
      redirectUrl: "/bookings/" + booking._id + "/success",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Failed to verify UPI payment." });
  }
};
