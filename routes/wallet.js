const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn } = require("../middleware.js");
const walletController = require("../controllers/wallet.js");

router.get("/", isLoggedIn, wrapAsync(walletController.viewWallet));
router.get("/balance", isLoggedIn, wrapAsync(walletController.getBalance));

module.exports = router;

