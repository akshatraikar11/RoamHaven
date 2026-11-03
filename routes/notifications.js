const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("../middleware");
const controller = require("../controllers/notifications");

router.get("/notifications", isLoggedIn, wrapAsync(controller.list));
router.post("/notifications/read-all", isLoggedIn, wrapAsync(controller.readAll));
router.post("/notifications/:id/read", isLoggedIn, wrapAsync(controller.markRead));

module.exports = router;

