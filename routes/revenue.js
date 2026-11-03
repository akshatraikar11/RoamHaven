const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isHost } = require("../middleware.js");
const revenueController = require("../controllers/revenue.js");

router.get("/", isLoggedIn, isHost, wrapAsync(revenueController.dashboard));

module.exports = router;

