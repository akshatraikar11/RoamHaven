const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const Listing = require("../models/listing.js");
const { isLoggedIn, isOwner, validateListing, isVerified } = require("../middleware.js");
const { listingSchemas, validate } = require("../utils/validators.js");

const listingController = require("../controllers/listings.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
// Feature #9: Changed from upload.single to upload.array (max 10 images)
const upload = multer({ storage });

router
  .route("/")
  .get(validate(listingSchemas.search, 'query'), wrapAsync(listingController.index))
  .post(
    isLoggedIn,
    isVerified,
    upload.array("listing[image]", 10),
    validate(listingSchemas.create),
    wrapAsync(listingController.createListing)
  );

// Feature #107: Aggregation-backed marketplace insights
router.get(
  "/insights/market",
  wrapAsync(listingController.getMarketInsights)
);

// Feature #136: listing comparison
router.get("/compare", wrapAsync(listingController.compareListings));

// System Design: O(1) Cursor-Based Pagination Feed API
router.get("/api/cursor-feed", wrapAsync(listingController.getCursorFeed));


router.get("/new", isLoggedIn, listingController.renderNewForm);

router
  .route("/:id")
  .get(wrapAsync(listingController.ShowListing))
  .put(
    isLoggedIn,
    isOwner,
    upload.array("listing[image]", 10),
    validate(listingSchemas.update),
    wrapAsync(listingController.updateListing)
  )
  .delete(isLoggedIn, isOwner, wrapAsync(listingController.destroyListing));

// Edit Route
router.get(
  "/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(listingController.renderEditForm)
);

// Feature #19: Analytics Route (host-only)
router.get(
  "/:id/analytics",
  isLoggedIn,
  wrapAsync(listingController.getAnalytics)
);

// Feature #19: Track Click (AJAX)
router.post(
  "/:id/track-click",
  wrapAsync(listingController.trackClick)
);

// Feature #16: Availability Calendar API
router.get(
  "/:id/availability",
  wrapAsync(listingController.getAvailability)
);

router.put(
  "/:id/availability",
  isLoggedIn,
  isOwner,
  validate(listingSchemas.availability),
  wrapAsync(listingController.updateAvailability)
);

// Feature #17: Dynamic Price API
router.get(
  "/:id/dynamic-price",
  validate(listingSchemas.dynamicPrice, 'query'),
  wrapAsync(listingController.getDynamicPrice)
);

// Feature #9: Delete Image (AJAX)
router.post(
  "/:id/delete-image",
  isLoggedIn,
  isOwner,
  wrapAsync(listingController.deleteImage)
);

// Feature #131: price drop alerts
router.post(
  "/:id/price-alert",
  isLoggedIn,
  validate(listingSchemas.priceAlert),
  wrapAsync(listingController.createPriceAlert)
);
router.post("/:id/price-alert/remove", isLoggedIn, wrapAsync(listingController.removePriceAlert));

// AI Itinerary Route
router.post("/:id/itinerary", wrapAsync(listingController.createItinerary));

// Feature #46: AI Review Summary Route
router.post("/:id/review-summary", wrapAsync(listingController.createReviewSummary));

module.exports = router;
