const Listing = require("../../../models/listing");

describe("Listing Model", () => {
  let listingData;

  beforeEach(() => {
    listingData = {
      title: "Test Listing",
      description: "A beautiful test listing",
      price: 1000,
      location: "Test City",
      country: "Test Country",
      geometry: {
        type: "Point",
        coordinates: [0, 0],
      },
      category: "trending",
      amenities: ["wifi", "ac"],
      maxGuests: 4,
      bedrooms: 2,
      bathrooms: 1,
      beds: 2,
    };
  });

  test("creates listing with required fields", () => {
    const listing = new Listing(listingData);
    expect(listing.title).toBe("Test Listing");
    expect(listing.price).toBe(1000);
    expect(listing.category).toBe("trending");
  });

  test("requires title field", () => {
    const listing = new Listing({ ...listingData, title: undefined });
    const validation = listing.validateSync();
    expect(validation.errors.title).toBeDefined();
  });

  test("accepts multiple images", () => {
    const listing = new Listing({
      ...listingData,
      images: [
        { url: "http://example.com/img1.jpg", filename: "img1" },
        { url: "http://example.com/img2.jpg", filename: "img2" },
      ],
    });
    expect(listing.images).toHaveLength(2);
  });

  test("accepts amenities array", () => {
    const listing = new Listing(listingData);
    expect(listing.amenities).toContain("wifi");
    expect(listing.amenities).toContain("ac");
  });

  test("accepts weekend pricing", () => {
    const listing = new Listing({ ...listingData, weekendPrice: 1500 });
    expect(listing.weekendPrice).toBe(1500);
  });

  test("accepts seasonal pricing array", () => {
    const seasonalPricing = [
      { name: "Summer", startDate: "2024-06-01", endDate: "2024-08-31", price: 2000 },
    ];
    const listing = new Listing({ ...listingData, seasonalPricing });
    expect(listing.seasonalPricing).toHaveLength(1);
  });

  test("has default surge multiplier of 1", () => {
    const listing = new Listing(listingData);
    expect(listing.surgeMultiplier).toBe(1);
  });

  test("has default room details", () => {
    const listing = new Listing(listingData);
    expect(listing.maxGuests).toBe(4);
    expect(listing.bedrooms).toBe(2);
    expect(listing.bathrooms).toBe(1);
    expect(listing.beds).toBe(2);
  });

  test("has analytics object with defaults", () => {
    const listing = new Listing(listingData);
    expect(listing.analytics).toBeDefined();
    expect(listing.analytics.viewCount).toBe(0);
    expect(listing.analytics.clickCount).toBe(0);
    expect(listing.analytics.bookingCount).toBe(0);
  });

  test("has blocked dates array", () => {
    const listing = new Listing(listingData);
    expect(listing.blockedDates).toBeDefined();
    expect(Array.isArray(listing.blockedDates)).toBe(true);
  });

  test("has price history array", () => {
    const listing = new Listing(listingData);
    expect(listing.priceHistory).toBeDefined();
    expect(Array.isArray(listing.priceHistory)).toBe(true);
  });

  test("has createdAt timestamp", () => {
    const listing = new Listing(listingData);
    expect(listing.createdAt).toBeDefined();
  });

  test("validates category enum", () => {
    const listing = new Listing({ ...listingData, category: "invalid_category" });
    const validation = listing.validateSync();
    expect(validation.errors.category).toBeDefined();
  });

  test("validates amenities enum", () => {
    const listing = new Listing({ ...listingData, amenities: ["invalid_amenity"] });
    const validation = listing.validateSync();
    expect(validation.errors["amenities.0"]).toBeDefined();
  });
});
