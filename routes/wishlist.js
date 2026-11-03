const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("../middleware");
const controller = require("../controllers/wishlist");

router.get("/wishlist", isLoggedIn, wrapAsync(controller.index));
router.post("/wishlist/:listingId/toggle", isLoggedIn, wrapAsync(controller.toggle));

module.exports = router;

