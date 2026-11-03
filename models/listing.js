const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  image: {
    url: String,
    filename: String,
  },
  // Feature #9: Multi-Image Upload
  images: [
    {
      url: String,
      filename: String,
    },
  ],
  price: Number,
  location: String,
  country: String,
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  geometry: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  category: {
    type: String,
    enum: [
      "trending",
      "rooms",
      "iconic_cities",
      "mountains",
      "castles",
      "pools",
      "camping",
      "farms",
      "arctic",
      "pg_hostel",
    ],
  },
  // Feature #13: Amenities System
  amenities: [
    {
      type: String,
      enum: [
        "wifi",
        "ac",
        "kitchen",
        "parking",
        "pool",
        "tv",
        "washer",
        "dryer",
        "heating",
        "gym",
        "elevator",
        "balcony",
        "garden",
        "bbq",
        "hot_tub",
        "fireplace",
        "workspace",
        "pet_friendly",
        "security_camera",
        "smoke_alarm",
      ],
    },
  ],
  // Feature #17: Dynamic Pricing
  weekendPrice: Number,
  seasonalPricing: [
    {
      name: String,
      startDate: Date,
      endDate: Date,
      price: Number,
    },
  ],
  // Feature #135: surge pricing multiplier
  surgeMultiplier: { type: Number, default: 1 },
  // Feature #23: Max Guests & Room Details
  maxGuests: { type: Number, default: 2 },
  bedrooms: { type: Number, default: 1 },
  bathrooms: { type: Number, default: 1 },
  beds: { type: Number, default: 1 },
  // Feature #19: Listing Analytics
  analytics: {
    viewCount: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
    bookingCount: { type: Number, default: 0 },
  },
  // Feature #16: Availability Calendar — blocked dates
  blockedDates: [{ type: Date }],
  // Feature #131: track price changes for price-drop alerts
  priceHistory: [
    {
      price: Number,
      changedAt: { type: Date, default: Date.now },
    },
  ],
  // Timestamp for "newest" sorting
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Feature #12: Full-Text Search Index
listingSchema.index(
  { title: "text", description: "text", location: "text", country: "text" },
  {
    weights: {
      title: 8,
      location: 5,
      country: 3,
      description: 1,
    },
    name: "listing_text_search",
  }
);
// Feature #104: Compound indexing strategy for common marketplace queries
listingSchema.index({ category: 1, price: 1, createdAt: -1 });
listingSchema.index({ location: 1, price: 1, category: 1 });
listingSchema.index({ owner: 1, createdAt: -1 });
listingSchema.index({ maxGuests: 1, price: 1 });
listingSchema.index({ "analytics.viewCount": -1, createdAt: -1 });
listingSchema.index({ geometry: "2dsphere" });

listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing) {
    await Review.deleteMany({ _id: { $in: listing.reviews } });
  }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
