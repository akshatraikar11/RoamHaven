const Listing = require("./models/listing.js");
const Review = require("./models/review.js");
const {
  ExpressError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("./schema.js");

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "You must be logged in to perform this action");
    return res.redirect("/login");
  }
  next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
  }
  next();
};

module.exports.isOwner = async (req, res, next) => {
  let { id } = req.params;
  let listing = await Listing.findById(id);
  if (!listing) {
    throw new NotFoundError("Listing not found");
  }
  if (!req.user) {
    req.session.redirectUrl = req.originalUrl;
    throw new AuthenticationError("You must be logged in to do that");
  }
  // Admins can bypass owner check
  if (req.user.role === "admin") {
    return next();
  }
  const currentUserId = res.locals.currUser?._id || req.user?._id;
  if (!currentUserId || !listing.owner?.equals(currentUserId)) {
    throw new AuthorizationError("You are not the owner of this listing");
  }
  next();
};

module.exports.validateListing = (req, res, next) => {
  let { error } = listingSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ValidationError(errMsg, error.details);
  } else {
    next();
  }
};

module.exports.validateReview = (req, res, next) => {
  let { error } = reviewSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ValidationError(errMsg, error.details);
  } else {
    next();
  }
};

module.exports.isReviewAuthor = async (req, res, next) => {
  let { id, reviewId } = req.params;
  let review = await Review.findById(reviewId);
  if (!review) {
    throw new NotFoundError("Review not found");
  }
  if (!req.user) {
    req.session.redirectUrl = req.originalUrl;
    throw new AuthenticationError("You must be logged in to do that");
  }
  // Admins can bypass author check
  if (req.user.role === "admin") {
    return next();
  }
  const currentUserId = res.locals.currUser?._id || req.user?._id;
  if (!currentUserId || !review.author?.equals(currentUserId)) {
    throw new AuthorizationError("You are not the author of this review");
  }
  next();
};

// ==============================
// Feature #1: RBAC Middleware
// ==============================

module.exports.isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    throw new AuthorizationError("You do not have admin privileges.");
  }
  next();
};

module.exports.isHost = (req, res, next) => {
  if (!req.user || !["host", "admin"].includes(req.user.role)) {
    throw new AuthorizationError("You need to be a host to perform this action.");
  }
  next();
};

module.exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AuthorizationError("You are not authorized to perform this action.");
    }
    next();
  };
};

// ==============================
// Feature #2: Email Verification
// ==============================

module.exports.isVerified = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    req.flash("error", "Please verify your email before performing this action.");
    return res.redirect("/verify-email");
  }
  next();
};
