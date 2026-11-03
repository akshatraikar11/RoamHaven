const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Review = require("../models/review");
const PriceAlert = require("../models/priceAlert");
const { cloudinary } = require("../cloudConfig");
const {
  makeHashedKey,
  getNamespaceVersion,
  bumpNamespaceVersion,
  getJSON,
  setJSON,
} = require("../utils/cache");
const geocoder = require("../utils/geocoder");
const { AMENITIES_MAP, calculateDynamicPrice } = require("./listings/pricing");
const { getSeasonalCollectionFilter } = require("./listings/search");

async function invalidateListingCaches() {
  await Promise.all([
    bumpNamespaceVersion("listings:index"),
    bumpNamespaceVersion("listing:detail"),
    bumpNamespaceVersion("listing:analytics"),
    bumpNamespaceVersion("listing:insights"),
  ]);
}

// ==========================================
// INDEX — Search, Filter, Sort (#11, #12, #15)
// ==========================================
module.exports.index = async (req, res) => {
  let {
    q,           // search query (Feature #12)
    ai,          // Feature #71: natural language search
    location,    // dedicated location filter (Feature #11)
    minPrice,    // price filter min
    maxPrice,    // price filter max
    category,    // category filter
    amenities,   // amenities filter (comma-separated)
    sort,        // sort option
    minRating,   // minimum rating filter
    maxGuests,   // max guests filter
    collection,  // seasonal collection preset (#142)
  } = req.query;

  let aiSearchQuery = "";
  if (ai && String(ai).trim()) {
    const { parseNaturalLanguageSearch } = require("../utils/ai");
    aiSearchQuery = String(ai).trim();
    const intent = await parseNaturalLanguageSearch(aiSearchQuery);
    if (!location && intent.location) location = intent.location;
    if (!minPrice && intent.minPrice != null) minPrice = String(intent.minPrice);
    if (!maxPrice && intent.maxPrice != null) maxPrice = String(intent.maxPrice);
    if (!category && intent.category) category = intent.category;
    if (!maxGuests && intent.maxGuests != null) maxGuests = String(intent.maxGuests);
    if (!amenities && intent.amenities?.length) amenities = intent.amenities.join(",");
    if (!q && intent.keywords) q = intent.keywords;
  }

  const indexVersion = await getNamespaceVersion("listings:index");
  const rawCacheKey = JSON.stringify(req.query || {});
  const cacheKey = makeHashedKey(`listings:index:v${indexVersion}`, rawCacheKey);
  const cachedPayload = await getJSON(cacheKey);

  if (cachedPayload) {
    return res.render("listings/index.ejs", cachedPayload);
  }

  // Build MongoDB filter
  let filter = {};

  // Feature #12: Full-text search
  if (q && q.trim()) {
    filter.$text = { $search: q.trim() };
  }

  // Price range filter
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  // Category filter (from query param, not the UI filter chips)
  if (category && category !== "all") {
    filter.category = category;
  }

  const seasonalCollectionFilter = getSeasonalCollectionFilter(collection);
  if (seasonalCollectionFilter) {
    filter = { ...filter, ...seasonalCollectionFilter };
  }

  // Dedicated location filter (works alongside full-text query)
  if (location && location.trim()) {
    filter.location = { $regex: location.trim(), $options: "i" };
  }

  // Feature #13: Amenities filter
  if (amenities) {
    const amenityList = amenities.split(",").filter(Boolean);
    if (amenityList.length > 0) {
      filter.amenities = { $all: amenityList };
    }
  }

  // Max guests filter
  if (maxGuests) {
    filter.maxGuests = { $gte: Number(maxGuests) };
  }

  // Build sort option (Feature #15)
  let sortOption = {};
  switch (sort) {
    case "price_asc":
      sortOption = { price: 1 };
      break;
    case "price_desc":
      sortOption = { price: -1 };
      break;
    case "newest":
      sortOption = { createdAt: -1 };
      break;
    case "rating":
      // We'll sort in-memory after populating reviews
      sortOption = { createdAt: -1 };
      break;
    default:
      // Default: if text search, sort by relevance; otherwise newest
      if (q && q.trim()) {
        sortOption = { score: { $meta: "textScore" } };
      } else {
        sortOption = { createdAt: -1 };
      }
  }

  // Build projection for text search score
  let queryBuilder = Listing.find(filter);
  if (q && q.trim() && !sort) {
    queryBuilder = queryBuilder.select({ score: { $meta: "textScore" } });
  }

  let allListings = await queryBuilder
    .populate({ path: "reviews", select: "rating" })
    .sort(sortOption);

  // Rating filter (post-query since avg is computed)
  if (minRating) {
    const minRat = Number(minRating);
    allListings = allListings.filter((listing) => {
      if (listing.reviews.length === 0) return false;
      const avg =
        listing.reviews.reduce((acc, r) => acc + r.rating, 0) /
        listing.reviews.length;
      return avg >= minRat;
    });
  }

  // Sort by rating (post-query)
  if (sort === "rating") {
    allListings.sort((a, b) => {
      const avgA =
        a.reviews.length > 0
          ? a.reviews.reduce((acc, r) => acc + r.rating, 0) / a.reviews.length
          : 0;
      const avgB =
        b.reviews.length > 0
          ? b.reviews.reduce((acc, r) => acc + r.rating, 0) / b.reviews.length
          : 0;
      return avgB - avgA;
    });
  }

  const viewModel = {
    allListings,
    searchQuery: q || "",
    aiSearchQuery,
    filters: {
      minPrice,
      maxPrice,
      category,
      amenities,
      sort,
      minRating,
      maxGuests,
      location,
      collection,
    },
    AMENITIES_MAP,
    // Feature #65/#66: map payload for index clustering + split view
    mapData: {
      type: "FeatureCollection",
      features: allListings
        .filter((l) => l.geometry && l.geometry.type === "Point" && Array.isArray(l.geometry.coordinates))
        .map((l) => ({
          type: "Feature",
          geometry: l.geometry,
          properties: {
            id: String(l._id),
            title: l.title,
            location: `${l.location || ""}${l.country ? ", " + l.country : ""}`.trim(),
            price: l.price || 0,
            image: l.image?.url || "",
          },
        })),
    },
  };

  await setJSON(cacheKey, viewModel, 90);
  res.render("listings/index.ejs", viewModel);
};

// ==========================================
// RENDER NEW FORM
// ==========================================
module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs", { AMENITIES_MAP });
};

// ==========================================
// SHOW LISTING (#17 dynamic price, #19 analytics)
// ==========================================
module.exports.ShowListing = async (req, res) => {
  let { id } = req.params;
  const detailVersion = await getNamespaceVersion("listing:detail");
  const hasUser = !!req.user;
  const cacheKey = makeHashedKey(
    `listing:detail:v${detailVersion}`,
    JSON.stringify({ id, hasUser, userId: req.user?._id || null })
  );
  const cachedPayload = await getJSON(cacheKey);

  if (cachedPayload) {
    // Keep view count up to date even on cache hit.
    await Listing.findByIdAndUpdate(id, {
      $inc: { "analytics.viewCount": 1 },
    });
    return res.render("listings/show.ejs", cachedPayload);
  }

  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");
  if (!listing) {
    req.flash("error", " Listing you requested for does not exist!");
    return res.redirect("/listings");
  }

  // Feature #19: Increment view count
  await Listing.findByIdAndUpdate(id, {
    $inc: { "analytics.viewCount": 1 },
  });

  // Check if current user has already booked this listing
  let hasBooked = false;
  if (req.user) {
    const existingBooking = await Booking.findOne({
      listing: id,
      user: req.user._id,
    });
    hasBooked = !!existingBooking;
  }

  // Compute average rating from actual reviews
  let avgRating = 0;
  let ratingPercentages = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  if (listing.reviews.length > 0) {
    let totalRating = 0;
    let ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    listing.reviews.forEach((review) => {
      totalRating += review.rating;
      ratingCounts[review.rating] = (ratingCounts[review.rating] || 0) + 1;
    });
    avgRating = (totalRating / listing.reviews.length).toFixed(2);
    for (let i = 1; i <= 5; i++) {
      ratingPercentages[i] = Math.round(
        (ratingCounts[i] / listing.reviews.length) * 100
      );
    }
  }

  // Compute hosting duration from owner account creation
  let hostingSince = "New host";
  if (listing.owner && listing.owner._id) {
    const createdAt = listing.owner._id.getTimestamp();
    const diffMs = Date.now() - createdAt;
    const diffMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
    if (diffMonths < 1) hostingSince = "New host";
    else if (diffMonths === 1) hostingSince = "1 month hosting";
    else if (diffMonths < 12) hostingSince = `${diffMonths} months hosting`;
    else {
      const years = Math.floor(diffMonths / 12);
      hostingSince =
        years === 1 ? "1 year hosting" : `${years} years hosting`;
    }
  }

  // Feature #17: Calculate dynamic price for default dates
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 3);
  const dynamicPrice = calculateDynamicPrice(listing, tomorrow, dayAfter);

  // Feature #41: Calculate averages for the 6 review criteria
  let categoryAverages = {
    cleanliness: 0,
    accuracy: 0,
    communication: 0,
    location: 0,
    value: 0,
    checkIn: 0
  };

  if (listing.reviews.length > 0) {
    let cleanlinessSum = 0;
    let accuracySum = 0;
    let communicationSum = 0;
    let locationSum = 0;
    let valueSum = 0;
    let checkInSum = 0;

    listing.reviews.forEach((review) => {
      const r = review.ratings || { cleanliness: 5, accuracy: 5, communication: 5, location: 5, value: 5, checkIn: 5 };
      cleanlinessSum += Number(r.cleanliness || 5);
      accuracySum += Number(r.accuracy || 5);
      communicationSum += Number(r.communication || 5);
      locationSum += Number(r.location || 5);
      valueSum += Number(r.value || 5);
      checkInSum += Number(r.checkIn || 5);
    });

    categoryAverages.cleanliness = (cleanlinessSum / listing.reviews.length).toFixed(1);
    categoryAverages.accuracy = (accuracySum / listing.reviews.length).toFixed(1);
    categoryAverages.communication = (communicationSum / listing.reviews.length).toFixed(1);
    categoryAverages.location = (locationSum / listing.reviews.length).toFixed(1);
    categoryAverages.value = (valueSum / listing.reviews.length).toFixed(1);
    categoryAverages.checkIn = (checkInSum / listing.reviews.length).toFixed(1);
  }

  const viewModel = {
    listing,
    hasBooked,
    avgRating,
    ratingPercentages,
    hostingSince,
    dynamicPrice,
    AMENITIES_MAP,
    categoryAverages,
    comparisonCandidates: [],
    userPriceAlert: null,
  };

  if (req.user) {
    viewModel.userPriceAlert = await PriceAlert.findOne({
      user: req.user._id,
      listing: listing._id,
      isActive: true,
    });
  }

  viewModel.comparisonCandidates = await Listing.find({
    _id: { $ne: listing._id },
    category: listing.category,
  })
    .select("title location country price maxGuests bedrooms bathrooms beds image")
    .limit(6);

  await setJSON(cacheKey, viewModel, 120);
  res.render("listings/show.ejs", viewModel);
};

// ==========================================
// CREATE LISTING (#9 multi-image, #13 amenities, #23 room details, #17 pricing)
// ==========================================
module.exports.createListing = async (req, res) => {
  // 1. Geocode location using OpenCage API
  const geoData = await geocoder.geocode(req.body.listing.location);

  if (!geoData || geoData.length === 0) {
    req.flash("error", "Invalid location. Please try a different location.");
    return res.redirect("/listings/new");
  }

  const coordinates = [geoData[0].longitude, geoData[0].latitude];

  // 2. Create new listing and assign geolocation
  const newListing = new Listing(req.body.listing);
  newListing.geometry = {
    type: "Point",
    coordinates: coordinates,
  };

  // 3. Handle image upload (Cloudinary) — Feature #9: Multi-image
  if (req.files && req.files.length > 0) {
    // First file is the primary image
    newListing.image = {
      url: req.files[0].path,
      filename: req.files[0].filename,
    };
    // All files go into the images array
    newListing.images = req.files.map((f) => ({
      url: f.path,
      filename: f.filename,
    }));
  }

  // 4. Handle amenities (from checkboxes)
  if (req.body.listing.amenities) {
    newListing.amenities = Array.isArray(req.body.listing.amenities)
      ? req.body.listing.amenities
      : [req.body.listing.amenities];
  }

  // 5. Handle weekend price
  if (req.body.listing.weekendPrice) {
    newListing.weekendPrice = Number(req.body.listing.weekendPrice);
  }

  // 6. Set current user as owner
  newListing.owner = req.user._id;

  // 7. Save and redirect
  const savedListing = await newListing.save();
  await invalidateListingCaches();
  req.flash("success", "New Listing Created!");
  res.redirect(`/listings/${savedListing._id}`);
};

// ==========================================
// RENDER EDIT FORM
// ==========================================
module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", " Listing you requested for does not exist!");
    return res.redirect("/listings");
  }
  let originalImageUrl = listing.image.url;
  originalImageUrl = originalImageUrl.replace("/upload", "/upload/h_300,w_250");
  res.render("listings/edit.ejs", { listing, originalImageUrl, AMENITIES_MAP });
};

// ==========================================
// UPDATE LISTING (#9 multi-image)
// ==========================================
module.exports.updateListing = async (req, res) => {
  let { id } = req.params;
  const existingListing = await Listing.findById(id);
  let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

  // Feature #131: track price updates for alerting
  if (
    existingListing &&
    req.body.listing &&
    req.body.listing.price &&
    Number(req.body.listing.price) !== Number(existingListing.price)
  ) {
    listing.priceHistory = listing.priceHistory || [];
    listing.priceHistory.push({ price: Number(req.body.listing.price) });
  }

  // Handle new image uploads (multi-image)
  if (req.files && req.files.length > 0) {
    // Set first uploaded as primary
    listing.image = {
      url: req.files[0].path,
      filename: req.files[0].filename,
    };
    // Append new images to existing images array
    const newImages = req.files.map((f) => ({
      url: f.path,
      filename: f.filename,
    }));
    listing.images = listing.images
      ? [...listing.images, ...newImages]
      : newImages;
    await listing.save();
  }

  // Handle amenities
  if (req.body.listing.amenities) {
    listing.amenities = Array.isArray(req.body.listing.amenities)
      ? req.body.listing.amenities
      : [req.body.listing.amenities];
    await listing.save();
  } else {
    // If no amenities checked, clear them
    listing.amenities = [];
    await listing.save();
  }

  await invalidateListingCaches();

  // Feature #131: trigger price drop alerts
  await PriceAlert.updateMany(
    {
      listing: listing._id,
      isActive: true,
      isTriggered: false,
      targetPrice: { $gte: listing.price },
    },
    { $set: { isTriggered: true, triggeredAt: new Date() } }
  );

  req.flash("success", "Listing Updated!");
  res.redirect(`/listings/${id}`);
};

// ==========================================
// DELETE IMAGE (AJAX endpoint for edit page)
// ==========================================
module.exports.deleteImage = async (req, res) => {
  const { id } = req.params;
  const { filename } = req.body;

  // Remove from Cloudinary
  try {
    await cloudinary.uploader.destroy(filename);
  } catch (e) {
    console.log("Cloudinary deletion error:", e);
  }

  // Remove from listing
  await Listing.findByIdAndUpdate(id, {
    $pull: { images: { filename: filename } },
  });

  // If the deleted image was the primary image, update primary
  const listing = await Listing.findById(id);
  if (listing.image && listing.image.filename === filename) {
    if (listing.images && listing.images.length > 0) {
      listing.image = listing.images[0];
    } else {
      listing.image = { url: "", filename: "" };
    }
    await listing.save();
  }

  await invalidateListingCaches();
  res.json({ success: true });
};

// ==========================================
// DELETE LISTING
// ==========================================
module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;
  let deleteListing = await Listing.findByIdAndDelete(id);
  await invalidateListingCaches();
  req.flash("success", " Listing Deleted! ");
  res.redirect("/listings");
};

// ==========================================
// Feature #19: Listing Analytics for Hosts
// ==========================================
module.exports.getAnalytics = async (req, res) => {
  const { id } = req.params;

  // SECURITY: ownership must be checked BEFORE serving any cached payload.
  // The cache key below is not scoped per-viewer, so if the auth check ran
  // after the cache read (as it previously did), any logged-in user could
  // view another host's private booking/revenue analytics simply by hitting
  // the same listing's analytics URL while a cached copy existed.
  const listing = await Listing.findById(id).populate("owner");

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  if (
    !req.user._id.equals(listing.owner._id) &&
    req.user.role !== "admin"
  ) {
    req.flash("error", "You can only view analytics for your own listings.");
    return res.redirect(`/listings/${id}`);
  }

  const analyticsVersion = await getNamespaceVersion("listing:analytics");
  const cacheKey = makeHashedKey(`listing:analytics:v${analyticsVersion}`, id);
  const cachedPayload = await getJSON(cacheKey);

  if (cachedPayload) {
    return res.render("listings/analytics.ejs", cachedPayload);
  }

  // Aggregation-backed booking stats (#107)
  const bookingStats = await Booking.aggregate([
    { $match: { listing: listing._id } },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        confirmedBookings: {
          $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
        },
        totalRevenuePaise: { $sum: "$totalAmount" },
      },
    },
  ]);

  const bookingCount = bookingStats[0]?.totalBookings || 0;
  const confirmedBookings = bookingStats[0]?.confirmedBookings || 0;
  const totalRevenueRupees = Math.round((bookingStats[0]?.totalRevenuePaise || 0) / 100);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  const bookingTrends = await Booking.aggregate([
    {
      $match: {
        listing: listing._id,
        createdAt: { $gte: sixMonthsAgo },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        bookings: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  const reviewStats = await Review.aggregate([
    { $match: { _id: { $in: listing.reviews || [] } } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  // Calculate conversion rate
  const views = listing.analytics ? listing.analytics.viewCount : 0;
  const conversionRate =
    views > 0 ? ((bookingCount / views) * 100).toFixed(2) : 0;

  const monthMap = new Map();
  bookingTrends.forEach((row) => {
    const key = `${row._id.year}-${String(row._id.month).padStart(2, "0")}`;
    monthMap.set(key, row.bookings);
  });
  const trendLabels = [];
  const trendValues = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    trendLabels.push(
      d.toLocaleString("en-IN", { month: "short", year: "numeric" })
    );
    trendValues.push(monthMap.get(key) || 0);
  }

  const viewModel = {
    listing,
    bookingCount,
    confirmedBookings,
    conversionRate,
    totalRevenueRupees,
    avgListingRating: (reviewStats[0]?.avgRating || 0).toFixed(1),
    reviewCount: reviewStats[0]?.reviewCount || 0,
    trendLabels,
    trendValues,
  };

  await setJSON(cacheKey, viewModel, 180);
  res.render("listings/analytics.ejs", viewModel);
};

// ==========================================
// Feature #19: Track Click (AJAX)
// ==========================================
module.exports.trackClick = async (req, res) => {
  const { id } = req.params;
  await Listing.findByIdAndUpdate(id, {
    $inc: { "analytics.clickCount": 1 },
  });
  await bumpNamespaceVersion("listing:analytics");
  res.json({ success: true });
};

// ==========================================
// Feature #16: Get Availability (JSON API)
// ==========================================
module.exports.getAvailability = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id).select("blockedDates");
  if (!listing) return res.status(404).json({ error: "Listing not found" });

  const blockedDates = (listing.blockedDates || []).map(
    (d) => d.toISOString().split("T")[0]
  );
  res.json({ blockedDates });
};

// ==========================================
// Feature #16: Update Availability (Host-only)
// ==========================================
module.exports.updateAvailability = async (req, res) => {
  const { id } = req.params;
  const { date, action } = req.body; // action: "block" or "unblock"

  if (!date || !action) {
    return res.status(400).json({ error: "Date and action are required" });
  }

  const dateObj = new Date(date);

  if (action === "block") {
    await Listing.findByIdAndUpdate(id, {
      $addToSet: { blockedDates: dateObj },
    });
  } else if (action === "unblock") {
    await Listing.findByIdAndUpdate(id, {
      $pull: { blockedDates: dateObj },
    });
  }

  await bumpNamespaceVersion("listing:detail");
  res.json({ success: true });
};

// ==========================================
// Feature #17: Get Dynamic Price (JSON API)
// ==========================================
module.exports.getDynamicPrice = async (req, res) => {
  const { id } = req.params;
  const { checkIn, checkOut } = req.query;

  const listing = await Listing.findById(id).select(
    "price weekendPrice seasonalPricing"
  );
  if (!listing) return res.status(404).json({ error: "Listing not found" });

  const priceInfo = calculateDynamicPrice(listing, checkIn, checkOut);
  res.json(priceInfo);
};

// Feature #131: Price drop alerts
module.exports.createPriceAlert = async (req, res) => {
  const { id } = req.params;
  const { targetPrice } = req.body;
  const numericTarget = Number(targetPrice);

  if (!numericTarget || numericTarget <= 0) {
    req.flash("error", "Please enter a valid target price.");
    return res.redirect(`/listings/${id}`);
  }

  const listing = await Listing.findById(id).select("price");
  if (!listing) {
    req.flash("error", "Listing not found.");
    return res.redirect("/listings");
  }

  await PriceAlert.findOneAndUpdate(
    { user: req.user._id, listing: id },
    {
      user: req.user._id,
      listing: id,
      targetPrice: numericTarget,
      isActive: true,
      isTriggered: listing.price <= numericTarget,
      triggeredAt: listing.price <= numericTarget ? new Date() : null,
    },
    { upsert: true, new: true }
  );

  req.flash("success", "Price alert saved successfully.");
  res.redirect(`/listings/${id}`);
};

module.exports.removePriceAlert = async (req, res) => {
  const { id } = req.params;
  await PriceAlert.findOneAndUpdate(
    { user: req.user._id, listing: id },
    { isActive: false }
  );
  req.flash("success", "Price alert removed.");
  res.redirect(`/listings/${id}`);
};

// Feature #136: Listing comparison tool
module.exports.compareListings = async (req, res) => {
  const ids = String(req.query.ids || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (ids.length < 2) {
    req.flash("error", "Select at least 2 listings to compare.");
    return res.redirect("/listings");
  }

  const listings = await Listing.find({ _id: { $in: ids } })
    .populate({ path: "reviews", select: "rating" })
    .select("title location country category price maxGuests bedrooms bathrooms beds amenities image");

  const cards = listings.map((listing) => {
    const avgRating =
      listing.reviews.length > 0
        ? (
            listing.reviews.reduce((acc, r) => acc + r.rating, 0) /
            listing.reviews.length
          ).toFixed(1)
        : "New";

    return { listing, avgRating };
  });

  res.render("listings/compare.ejs", { cards });
};

// ==========================================
// AI Itinerary Controller
// ==========================================
const { generateItinerary } = require("../utils/ai.js");
module.exports.createItinerary = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    return res.status(404).json({ error: "Listing not found" });
  }

  try {
    const itinerary = await generateItinerary(listing.title, listing.location);
    res.json({ itinerary });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate itinerary" });
  }
};

// ==========================================
// Feature #46: AI Review Summary Controller
// ==========================================
const { generateReviewSummary } = require("../utils/ai.js");
module.exports.createReviewSummary = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id).populate("reviews");
  if (!listing) {
    return res.status(404).json({ error: "Listing not found" });
  }

  try {
    const summary = await generateReviewSummary(listing.title, listing.reviews);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate AI review summary" });
  }
};

// ==========================================
// Feature #107: Marketplace Insights via Aggregation
// ==========================================
module.exports.getMarketInsights = async (req, res) => {
  const insightsVersion = await getNamespaceVersion("listing:insights");
  const cacheKey = makeHashedKey(`listing:insights:v${insightsVersion}`, "market");
  const cachedPayload = await getJSON(cacheKey);

  if (cachedPayload) {
    return res.json(cachedPayload);
  }

  const [topLocations, categoryDistribution, topRatedLocations] = await Promise.all([
    Listing.aggregate([
      {
        $group: {
          _id: { location: "$location", country: "$country" },
          listingCount: { $sum: 1 },
          avgPrice: { $avg: "$price" },
        },
      },
      { $sort: { listingCount: -1, avgPrice: -1 } },
      { $limit: 8 },
      {
        $project: {
          _id: 0,
          location: "$_id.location",
          country: "$_id.country",
          listingCount: 1,
          avgPrice: { $round: ["$avgPrice", 0] },
        },
      },
    ]),
    Listing.aggregate([
      {
        $group: {
          _id: "$category",
          listingCount: { $sum: 1 },
          avgPrice: { $avg: "$price" },
        },
      },
      { $sort: { listingCount: -1 } },
      {
        $project: {
          _id: 0,
          category: "$_id",
          listingCount: 1,
          avgPrice: { $round: ["$avgPrice", 0] },
        },
      },
    ]),
    Listing.aggregate([
      {
        $lookup: {
          from: "reviews",
          localField: "reviews",
          foreignField: "_id",
          as: "reviewDocs",
        },
      },
      { $unwind: "$reviewDocs" },
      {
        $group: {
          _id: { location: "$location", country: "$country" },
          avgRating: { $avg: "$reviewDocs.rating" },
          reviewCount: { $sum: 1 },
        },
      },
      { $match: { reviewCount: { $gte: 2 } } },
      { $sort: { avgRating: -1, reviewCount: -1 } },
      { $limit: 8 },
      {
        $project: {
          _id: 0,
          location: "$_id.location",
          country: "$_id.country",
          avgRating: { $round: ["$avgRating", 1] },
          reviewCount: 1,
        },
      },
    ]),
  ]);

  const payload = {
    generatedAt: new Date().toISOString(),
    topLocations,
    categoryDistribution,
    topRatedLocations,
  };

  await setJSON(cacheKey, payload, 300);
  res.json(payload);
};

// ==========================================
// System Design: Cursor-Based Pagination API (O(1) Constant-Time Feed)
// ==========================================
module.exports.getCursorFeed = async (req, res) => {
  const { cursor, limit = 12, category } = req.query;
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);

  const query = {};
  if (category && category !== "all") {
    query.category = category;
  }
  if (cursor) {
    query._id = { $lt: cursor };
  }

  const listings = await Listing.find(query)
    .sort({ _id: -1 })
    .limit(pageSize + 1)
    .select("title price location country category image images maxGuests")
    .lean();

  const hasMore = listings.length > pageSize;
  const items = hasMore ? listings.slice(0, pageSize) : listings;
  const nextCursor = items.length > 0 ? items[items.length - 1]._id : null;

  res.json({
    success: true,
    count: items.length,
    hasMore,
    nextCursor: hasMore ? nextCursor : null,
    items,
  });
};
