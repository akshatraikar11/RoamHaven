const rateLimit = require("express-rate-limit");

const defaultHandler = (req, res) => {
  const isApiRequest =
    req.originalUrl.startsWith("/api") ||
    req.originalUrl.startsWith("/graphql") ||
    req.accepts("json");

  if (isApiRequest) {
    return res.status(429).json({
      error: "Too many requests. Please slow down and try again shortly.",
    });
  }

  req.flash("error", "Too many requests. Please wait a moment and try again.");
  return res.status(429).redirect("back");
};

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
});

module.exports = {
  generalLimiter,
  authLimiter,
  apiLimiter,
};

