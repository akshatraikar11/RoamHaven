const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("../middleware");
const tripsController = require("../controllers/trips");

router.get("/", isLoggedIn, wrapAsync(tripsController.index));
router.post("/", isLoggedIn, wrapAsync(tripsController.create));
router.get("/:id", isLoggedIn, wrapAsync(tripsController.show));
router.post("/:id/listings", isLoggedIn, wrapAsync(tripsController.addListing));
router.post("/:id/vote", isLoggedIn, wrapAsync(tripsController.vote));

module.exports = router;
