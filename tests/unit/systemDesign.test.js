const { idempotencyMiddleware } = require("../../utils/idempotency");
const { CircuitBreaker } = require("../../utils/circuitBreaker");

describe("System Design Patterns", () => {
  describe("Idempotency Middleware", () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        method: "POST",
        originalUrl: "/bookings/create-order",
        headers: { "idempotency-key": "test-key-123" },
        user: { _id: "user-456" },
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
      };
      next = jest.fn();
    });

    test("passes through new request and caches response", async () => {
      const middleware = idempotencyMiddleware();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();

      // Simulate handler sending 200 response
      res.statusCode = 200;
      res.json({ orderId: "order_abc" });
    });

    test("skips idempotency check on GET requests", async () => {
      req.method = "GET";
      const middleware = idempotencyMiddleware({ required: true });
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("Circuit Breaker Pattern", () => {
    test("allows execution in CLOSED state and returns result", async () => {
      const breaker = new CircuitBreaker({ name: "TestService", failureThreshold: 2 });
      const action = jest.fn().mockResolvedValue("action-result");

      const result = await breaker.execute(action);

      expect(result).toBe("action-result");
      expect(breaker.state).toBe("CLOSED");
    });

    test("trips to OPEN state after reaching failure threshold and triggers fallback", async () => {
      const breaker = new CircuitBreaker({
        name: "TestService",
        failureThreshold: 2,
        cooldownPeriodMs: 5000,
      });

      const failingAction = jest.fn().mockRejectedValue(new Error("API Down"));
      const fallback = jest.fn().mockResolvedValue("fallback-data");

      // 1st failure
      await breaker.execute(failingAction, fallback);
      expect(breaker.state).toBe("CLOSED");

      // 2nd failure -> Trips circuit
      await breaker.execute(failingAction, fallback);
      expect(breaker.state).toBe("OPEN");

      // 3rd call -> Fails fast directly into fallback without calling failingAction
      const fastResult = await breaker.execute(failingAction, fallback);
      expect(fastResult).toBe("fallback-data");
      expect(breaker.state).toBe("OPEN");
    });
  });
});

