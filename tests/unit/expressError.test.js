const {
  ExpressError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalServerError,
} = require("../../utils/ExpressError");

describe("ExpressError classes", () => {
  describe("ExpressError", () => {
    test("creates error with status code and message", () => {
      const error = new ExpressError(400, "Bad request");
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe("Bad request");
      expect(error.isOperational).toBe(true);
    });

    test("creates error with errors array", () => {
      const errors = [{ field: "email", message: "Invalid email" }];
      const error = new ExpressError(400, "Validation failed", errors);
      expect(error.errors).toEqual(errors);
    });

    test("captures stack trace", () => {
      const error = new ExpressError(500, "Server error");
      expect(error.stack).toBeDefined();
    });
  });

  describe("ValidationError", () => {
    test("creates validation error with 400 status", () => {
      const error = new ValidationError("Invalid input");
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("ValidationError");
      expect(error.isOperational).toBe(true);
    });

    test("accepts errors array", () => {
      const errors = [{ field: "title", message: "Required" }];
      const error = new ValidationError("Validation failed", errors);
      expect(error.errors).toEqual(errors);
    });
  });

  describe("AuthenticationError", () => {
    test("creates authentication error with 401 status", () => {
      const error = new AuthenticationError();
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe("AuthenticationError");
      expect(error.message).toBe("Authentication required");
    });

    test("accepts custom message", () => {
      const error = new AuthenticationError("Custom auth message");
      expect(error.message).toBe("Custom auth message");
    });
  });

  describe("AuthorizationError", () => {
    test("creates authorization error with 403 status", () => {
      const error = new AuthorizationError();
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe("AuthorizationError");
    });

    test("accepts custom message", () => {
      const error = new AuthorizationError("Custom authz message");
      expect(error.message).toBe("Custom authz message");
    });
  });

  describe("NotFoundError", () => {
    test("creates not found error with 404 status", () => {
      const error = new NotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe("NotFoundError");
    });

    test("accepts custom message", () => {
      const error = new NotFoundError("Custom not found");
      expect(error.message).toBe("Custom not found");
    });
  });

  describe("ConflictError", () => {
    test("creates conflict error with 409 status", () => {
      const error = new ConflictError();
      expect(error.statusCode).toBe(409);
      expect(error.name).toBe("ConflictError");
    });
  });

  describe("RateLimitError", () => {
    test("creates rate limit error with 429 status", () => {
      const error = new RateLimitError();
      expect(error.statusCode).toBe(429);
      expect(error.name).toBe("RateLimitError");
    });
  });

  describe("InternalServerError", () => {
    test("creates internal server error with 500 status", () => {
      const error = new InternalServerError();
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe("InternalServerError");
      expect(error.isOperational).toBe(false);
    });
  });
});
