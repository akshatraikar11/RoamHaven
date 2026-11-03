const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn } = require("../middleware.js");
const { idempotencyMiddleware } = require("../utils/idempotency.js");
const bookingController = require("../controllers/bookings.js");

router.get("/:id/book", isLoggedIn, wrapAsync(bookingController.renderBookingForm));

router.get("/:id/success", isLoggedIn, wrapAsync(bookingController.bookingSuccess));

router.post("/apply-coupon", isLoggedIn, wrapAsync(bookingController.applyCoupon));

// System Design: Idempotency protection for order creation, payment verification & refunds
router.post("/create-order", isLoggedIn, idempotencyMiddleware(), wrapAsync(bookingController.createOrder));
router.post("/upi/create-order", isLoggedIn, idempotencyMiddleware(), wrapAsync(bookingController.createUpiOrder));
router.post("/upi/verify-payment", isLoggedIn, idempotencyMiddleware(), wrapAsync(bookingController.verifyUpiPayment));
router.post("/verify-payment", isLoggedIn, idempotencyMiddleware(), wrapAsync(bookingController.verifyPayment));

router.get("/history", isLoggedIn, wrapAsync(bookingController.paymentHistory));
router.get("/my", isLoggedIn, wrapAsync(bookingController.guestBookings));
router.get("/host", isLoggedIn, wrapAsync(bookingController.hostBookings));
router.post("/:id/status", isLoggedIn, wrapAsync(bookingController.updateBookingStatus));
router.post("/:id/refund", isLoggedIn, idempotencyMiddleware(), wrapAsync(bookingController.refundBooking));
router.get("/:id/receipt.pdf", isLoggedIn, wrapAsync(bookingController.downloadReceiptPdf));
router.get("/share-card", wrapAsync(bookingController.shareTripCard));

module.exports = router;
