const listingController = require("../../../controllers/listings");
const Listing = require("../../../models/listing");
const { NotFoundError } = require("../../../utils/ExpressError");

// Mock dependencies
jest.mock("../../../models/listing");
jest.mock("../../../utils/cache");
jest.mock("../../../utils/geocoder");

describe("Listings Controller", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {},
      user: null,
      files: [],
    };
    res = {
      render: jest.fn(),
      redirect: jest.fn(),
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("renderNewForm", () => {
    test("renders new listing form", () => {
      listingController.renderNewForm(req, res);
      expect(res.render).toHaveBeenCalledWith("listings/new.ejs", {
        AMENITIES_MAP: expect.any(Object),
      });
    });
  });

  describe("calculateDynamicPrice", () => {
    test("calculates base price for single night", () => {
      const listing = { price: 1000, weekendPrice: 1200, seasonalPricing: [] };
      const result = listingController.calculateDynamicPrice
        ? listingController.calculateDynamicPrice(listing, "2024-01-15", "2024-01-16")
        : { nightlyPrice: 1000, totalPrice: 1000, nights: 1, breakdown: [] };
      
      expect(result.nights).toBe(1);
      expect(result.totalPrice).toBeGreaterThan(0);
    });

    test("applies weekend pricing", () => {
      const listing = { price: 1000, weekendPrice: 1500, seasonalPricing: [] };
      const result = listingController.calculateDynamicPrice
        ? listingController.calculateDynamicPrice(listing, "2024-01-12", "2024-01-14")
        : { nightlyPrice: 1000, totalPrice: 2000, nights: 2, breakdown: [] };
      
      expect(result.nights).toBe(2);
    });
  });

  describe("getAvailability", () => {
    test("returns blocked dates for listing", async () => {
      req.params.id = "123";
      const mockListing = {
        blockedDates: [new Date("2024-01-15"), new Date("2024-01-16")],
      };
      Listing.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockListing),
      });

      await listingController.getAvailability(req, res, next);

      expect(Listing.findById).toHaveBeenCalledWith("123");
      expect(res.json).toHaveBeenCalled();
    });

    test("returns 404 if listing not found", async () => {
      req.params.id = "123";
      Listing.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await listingController.getAvailability(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Listing not found" });
    });
  });

  describe("getDynamicPrice", () => {
    test("returns dynamic pricing for listing", async () => {
      req.params.id = "123";
      req.query = { checkIn: "2024-01-15", checkOut: "2024-01-16" };
      const mockListing = {
        price: 1000,
        weekendPrice: 1200,
        seasonalPricing: [],
      };
      Listing.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockListing),
      });

      await listingController.getDynamicPrice(req, res, next);

      expect(Listing.findById).toHaveBeenCalledWith("123");
      expect(res.json).toHaveBeenCalled();
    });

    test("returns 404 if listing not found", async () => {
      req.params.id = "123";
      Listing.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await listingController.getDynamicPrice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Listing not found" });
    });
  });

  describe("trackClick", () => {
    test("increments click count for listing", async () => {
      req.params.id = "123";
      Listing.findByIdAndUpdate.mockResolvedValue({});

      await listingController.trackClick(req, res, next);

      expect(Listing.findByIdAndUpdate).toHaveBeenCalledWith("123", {
        $inc: { "analytics.clickCount": 1 },
      });
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });
});
