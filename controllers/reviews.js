const Listing = require("../models/listing");
const Review = require("../models/review");
const Booking = require("../models/booking");
const { censorProfanity } = require("../utils/profanity");
const { bumpNamespaceVersion } = require("../utils/cache");

module.exports.createReview = async (req, res) => {
  let listing = await Listing.findById(req.params.id);
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  // Feature #44: Verified Stay Check (Admins bypass)
  // Previously matched ANY booking regardless of status, so a pending
  // (unpaid) or even cancelled booking was enough to earn a "Verified Stay"
  // badge. Restricted to bookings that actually reached a paid/stayed state.
  const bookingExists = await Booking.findOne({
    listing: listing._id,
    user: req.user._id,
    status: { $in: ["confirmed", "checked_in", "completed"] },
  });

  if (!bookingExists && req.user.role !== "admin") {
    req.flash("error", "Only guests who have booked this stay can leave a review.");
    return res.redirect(`/listings/${listing._id}`);
  }

  // Feature #42: Profanity Filter
  const sanitizedComment = censorProfanity(req.body.review.comment);

  // Feature #41: Calculate overall rating from multi-criteria ratings
  const ratings = req.body.review.ratings || {
    cleanliness: 5,
    accuracy: 5,
    communication: 5,
    location: 5,
    value: 5,
    checkIn: 5,
  };

  const sum =
    Number(ratings.cleanliness) +
    Number(ratings.accuracy) +
    Number(ratings.communication) +
    Number(ratings.location) +
    Number(ratings.value) +
    Number(ratings.checkIn);
  const avgRating = Math.round((sum / 6) * 100) / 100; // Keep up to 2 decimal places

  let newReview = new Review({
    comment: sanitizedComment,
    rating: avgRating,
    ratings: ratings,
    isVerifiedStay: !!bookingExists || req.user.role === "admin",
    author: req.user._id,
  });

  listing.reviews.push(newReview);

  await newReview.save();
  await listing.save();
  await Promise.all([
    bumpNamespaceVersion("listing:detail"),
    bumpNamespaceVersion("listing:analytics"),
    bumpNamespaceVersion("listing:insights"),
  ]);
  req.flash("success", "New Review Created!");
  res.redirect(`/listings/${listing._id}`);
};

module.exports.destroyReview = async (req, res) => {
  let { id, reviewId } = req.params;

  await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);
  await Promise.all([
    bumpNamespaceVersion("listing:detail"),
    bumpNamespaceVersion("listing:analytics"),
    bumpNamespaceVersion("listing:insights"),
  ]);
  req.flash("success", " Review Deleted!");

  res.redirect(`/listings/${id}`);
};
