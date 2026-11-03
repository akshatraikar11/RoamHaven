const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn } = require("../middleware.js");
const aiController = require("../controllers/ai.js");

router.post("/ai/search", isLoggedIn, wrapAsync(aiController.naturalLanguageSearch));
router.post(
  "/ai/generate-description",
  isLoggedIn,
  wrapAsync(aiController.generateDescription)
);

module.exports = router;
