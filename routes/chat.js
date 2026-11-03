const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { chatSchemas, validate } = require("../utils/validators");
const chatController = require("../controllers/chat.js");

router.post("/jarvis", validate(chatSchemas.message), wrapAsync(chatController.handleChat));

module.exports = router;
