const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isAdmin } = require("../middleware.js");
const adminController = require("../controllers/admin.js");
const couponsController = require("../controllers/coupons.js");

router.get("/", isAdmin, wrapAsync(adminController.dashboard));
router.get("/api/live-stats", isAdmin, wrapAsync(adminController.liveStatsApi));

router.get("/coupons", isAdmin, wrapAsync(couponsController.listCoupons));
router.post("/coupons", isAdmin, wrapAsync(couponsController.createCoupon));
router.put("/coupons/:id/toggle", isAdmin, wrapAsync(couponsController.toggleCoupon));
router.delete("/coupons/:id", isAdmin, wrapAsync(couponsController.deleteCoupon));

module.exports = router;
