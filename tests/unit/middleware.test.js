const {
  isLoggedIn,
  isOwner,
  validateListing,
  isAdmin,
  isHost,
  authorizeRoles,
  isVerified,
} = require("../../middleware");
const { ValidationError, AuthenticationError, AuthorizationError, NotFoundError } = require("../../utils/ExpressError");

describe("Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      isAuthenticated: jest.fn().mockReturnValue(false),
      user: null,
      session: {},
      originalUrl: "/test",
      body: {},
      flash: jest.fn(),
    };
    res = {
      redirect: jest.fn(),
      locals: {},
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("isLoggedIn", () => {
    test("redirects to login if not authenticated", () => {
      isLoggedIn(req, res, next);
      expect(req.session.redirectUrl).toBe("/test");
      expect(res.redirect).toHaveBeenCalledWith("/login");
      expect(next).not.toHaveBeenCalled();
    });

    test("calls next if authenticated", () => {
      req.isAuthenticated.mockReturnValue(true);
      isLoggedIn(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });

  describe("isAdmin", () => {
    test("throws AuthorizationError if not admin", () => {
      req.user = { role: "user" };
      expect(() => isAdmin(req, res, next)).toThrow(AuthorizationError);
    });

    test("calls next if admin", () => {
      req.user = { role: "admin" };
      isAdmin(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test("throws AuthorizationError if no user", () => {
      expect(() => isAdmin(req, res, next)).toThrow(AuthorizationError);
    });
  });

  describe("isHost", () => {
    test("throws AuthorizationError if not host or admin", () => {
      req.user = { role: "user" };
      expect(() => isHost(req, res, next)).toThrow(AuthorizationError);
    });

    test("calls next if host", () => {
      req.user = { role: "host" };
      isHost(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test("calls next if admin", () => {
      req.user = { role: "admin" };
      isHost(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("authorizeRoles", () => {
    test("throws AuthorizationError if role not authorized", () => {
      req.user = { role: "user" };
      const middleware = authorizeRoles("admin", "host");
      expect(() => middleware(req, res, next)).toThrow(AuthorizationError);
    });

    test("calls next if role is authorized", () => {
      req.user = { role: "host" };
      const middleware = authorizeRoles("admin", "host");
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("isVerified", () => {
    test("redirects if email not verified", () => {
      req.user = { isEmailVerified: false };
      isVerified(req, res, next);
      expect(res.redirect).toHaveBeenCalledWith("/verify-email");
    });

    test("calls next if email verified", () => {
      req.user = { isEmailVerified: true };
      isVerified(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
