const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn } = require("../middleware.js");
const bookingController = require("../controllers/bookings.js");

router.get("/:id/book", isLoggedIn, wrapAsync(bookingController.renderBookingForm));

router.post("/", isLoggedIn, wrapAsync(bookingController.createBooking));

module.exports = router;
