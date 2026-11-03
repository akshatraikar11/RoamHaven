const bookingController = require("../../../controllers/bookings");
const Listing = require("../../../models/listing");
const Booking = require("../../../models/booking");
const Payment = require("../../../models/payment");
const Coupon = require("../../../models/coupon");
const Wallet = require("../../../models/wallet");
const User = require("../../../models/user");
const { createOrder: createRzpOrder, verifyPaymentSignature } = require("../../../utils/razorpay");

jest.mock("../../../models/listing");
jest.mock("../../../models/booking");
jest.mock("../../../models/payment");
jest.mock("../../../models/coupon");
jest.mock("../../../models/wallet");
jest.mock("../../../models/user");
jest.mock("../../../models/notification", () => ({
  create: jest.fn().mockResolvedValue({}),
}));
jest.mock("../../../utils/razorpay");
jest.mock("../../../utils/cache", () => ({
  bumpNamespaceVersion: jest.fn().mockResolvedValue(true),
}));
jest.mock("../../../utils/email", () => ({
  sendBookingConfirmedEmail: jest.fn().mockResolvedValue(true),
  sendBookingStatusEmail: jest.fn().mockResolvedValue(true),
}));
jest.mock("../../../utils/analytics", () => ({
  emitAdminAnalytics: jest.fn(),
}));

describe("Bookings Controller - Unit Tests", () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {},
      user: {
        _id: "507f1f77bcf86cd799439011",
        equals: jest.fn((id) => id === "507f1f77bcf86cd799439011"),
      },
      flash: jest.fn(),
      app: { locals: { io: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) } } },
    };
    res = {
      render: jest.fn(),
      redirect: jest.fn(),
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe("applyCoupon", () => {
    test("returns error if listing not found", async () => {
      req.body = { listingId: "invalid", couponCode: "OFF10" };
      Listing.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await bookingController.applyCoupon(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: "Listing not found." })
      );
    });

    test("successfully applies percentage coupon within max discount limit", async () => {
      req.body = {
        listingId: "listing123",
        startDate: "2026-12-01",
        endDate: "2026-12-03",
        couponCode: "SAVE20",
      };
      Listing.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          price: 2000,
          weekendPrice: 2000,
          seasonalPricing: [],
        }),
      });
      Coupon.findOne.mockResolvedValue({
        _id: "coupon123",
        code: "SAVE20",
        isActive: true,
        discountType: "percentage",
        discountValue: 20,
        maxDiscount: 500,
        minBookingAmount: 1000,
        usedCount: 0,
      });

      await bookingController.applyCoupon(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          coupon: { id: "coupon123", code: "SAVE20" },
        })
      );
    });

    test("returns 400 when coupon is expired or invalid", async () => {
      req.body = {
        listingId: "listing123",
        couponCode: "EXPIRED",
      };
      Listing.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ price: 1000 }),
      });
      Coupon.findOne.mockResolvedValue(null);

      await bookingController.applyCoupon(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: "Invalid or inactive coupon." })
      );
    });
  });

  describe("createOrder", () => {
    test("creates pending booking and razorpay payment for valid input", async () => {
      req.body = {
        listingId: "listing123",
        startDate: "2026-12-01",
        endDate: "2026-12-03",
        name: "Akshat Raikar",
        mobile: "9999999999",
        email: "akshat@example.com",
        useWallet: false,
      };

      const mockOwnerId = "507f1f77bcf86cd799439099";
      Listing.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "listing123",
          title: "Mountain PG Stay",
          price: 1500,
          owner: { _id: mockOwnerId },
        }),
      });

      Wallet.findOne.mockResolvedValue({ balance: 0, transactions: [], save: jest.fn() });
      Booking.create.mockResolvedValue({
        _id: "booking123",
        save: jest.fn(),
      });
      Payment.create.mockResolvedValue({
        _id: "payment123",
        amount: 315000,
        status: "created",
        updateOne: jest.fn().mockResolvedValue({}),
        save: jest.fn().mockResolvedValue({}),
      });
      createRzpOrder.mockResolvedValue({
        id: "order_rzp_123",
        amount: 315000,
        currency: "INR",
      });

      await bookingController.createOrder(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          orderId: "order_rzp_123",
          bookingId: "booking123",
        })
      );
    });

    test("completes instant booking when total is paid entirely via wallet balance", async () => {
      req.body = {
        listingId: "listing123",
        startDate: "2026-12-01",
        endDate: "2026-12-03",
        name: "Akshat Raikar",
        mobile: "9999999999",
        email: "akshat@example.com",
        useWallet: true,
      };

      const mockOwnerId = "507f1f77bcf86cd799439099";
      Listing.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "listing123",
          title: "Mountain PG Stay",
          price: 1000,
          owner: { _id: mockOwnerId },
        }),
      });

      // Wallet with ample balance
      Wallet.findOne.mockResolvedValue({
        balance: 500000,
        transactions: [],
        save: jest.fn().mockResolvedValue({}),
      });
      const mockUserObj = {
        _id: req.user._id,
        badges: [],
        referredByCode: null,
        referralRewarded: false,
        save: jest.fn().mockResolvedValue({}),
      };
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUserObj),
        then: (resolve) => resolve(mockUserObj),
      });
      Booking.countDocuments.mockResolvedValue(1);

      Booking.create.mockResolvedValue({
        _id: "booking_wallet_123",
        save: jest.fn().mockResolvedValue({}),
      });
      Payment.create.mockResolvedValue({
        _id: "payment_wallet_123",
        amount: 210000,
        status: "paid",
        updateOne: jest.fn().mockResolvedValue({}),
        save: jest.fn().mockResolvedValue({}),
      });

      await bookingController.createOrder(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          redirectUrl: "/bookings/booking_wallet_123/success",
        })
      );
    });

    test("returns 401 if user is not authenticated", async () => {
      req.user = null;
      req.body = { listingId: "listing123" };
      Listing.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({ _id: "listing123" }),
      });

      await bookingController.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: "Not authenticated." })
      );
    });
  });

  describe("verifyPayment", () => {
    test("rejects invalid Razorpay HMAC signature", async () => {
      req.body = {
        bookingId: "booking123",
        razorpay_order_id: "order_123",
        razorpay_payment_id: "pay_123",
        razorpay_signature: "tampered_signature",
      };

      const mockBooking = {
        _id: "booking123",
        user: { equals: jest.fn(() => true) },
        payment: "payment123",
        updateOne: jest.fn(),
        save: jest.fn(),
      };
      Booking.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBooking),
      });

      const mockPayment = {
        _id: "payment123",
        status: "created",
        razorpayOrderId: "order_123",
        updateOne: jest.fn(),
        save: jest.fn(),
      };
      Payment.findById.mockResolvedValue(mockPayment);
      verifyPaymentSignature.mockReturnValue(false);

      await bookingController.verifyPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Payment signature verification failed.",
        })
      );
    });
  });

  describe("UPI Direct Gateway", () => {
    test("generates direct NPCI UPI order with zero-fee QR payload", async () => {
      req.body = {
        listingId: "listing123",
        startDate: "2026-12-01",
        endDate: "2026-12-03",
        name: "Akshat Raikar",
        mobile: "9999999999",
        email: "akshat@example.com",
      };

      Listing.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "listing123",
          title: "Goa Beach Villa",
          price: 3000,
          owner: { _id: "host_999" },
        }),
      });

      Wallet.findOne.mockResolvedValue({ balance: 0, transactions: [], save: jest.fn() });
      Booking.create.mockResolvedValue({
        _id: "booking_upi_123",
        save: jest.fn().mockResolvedValue({}),
      });
      Payment.create.mockResolvedValue({
        _id: "payment_upi_123",
        amount: 630000,
        status: "created",
        paymentMethod: "upi",
      });

      await bookingController.createUpiOrder(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          bookingId: "booking_upi_123",
          upiUri: expect.stringContaining("upi://pay"),
          qrImageUrl: expect.any(String),
        })
      );
    });

    test("verifies valid 12-digit UTR and confirms booking", async () => {
      req.body = {
        bookingId: "booking_upi_123",
        utrNumber: "412345678901",
      };

      const mockBooking = {
        _id: "booking_upi_123",
        user: { equals: jest.fn(() => true) },
        payment: "payment_upi_123",
        status: "pending",
        save: jest.fn().mockResolvedValue({}),
      };
      Booking.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBooking),
      });

      const mockPayment = {
        _id: "payment_upi_123",
        status: "created",
        amount: 630000,
        walletUsed: 0,
        save: jest.fn().mockResolvedValue({}),
      };
      Payment.findById.mockResolvedValue(mockPayment);

      const mockUserObj = {
        _id: req.user._id,
        badges: [],
        save: jest.fn().mockResolvedValue({}),
      };
      User.findById.mockResolvedValue(mockUserObj);
      Booking.countDocuments.mockResolvedValue(1);

      await bookingController.verifyUpiPayment(req, res);

      expect(mockPayment.status).toBe("paid");
      expect(mockPayment.upiUtr).toBe("412345678901");
      expect(mockBooking.status).toBe("confirmed");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        redirectUrl: "/bookings/booking_upi_123/success",
      });
    });

    test("rejects invalid UTR with 400", async () => {
      req.body = {
        bookingId: "booking_upi_123",
        utrNumber: "invalid-utr-short",
      };

      await bookingController.verifyUpiPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: "Invalid 12-digit UPI UTR number." })
      );
    });
  });
});
