const {
  metricsMiddleware,
  metricsHandler,
  httpRequestsTotal,
  httpRequestDurationMs,
  httpActiveConnections,
  paymentTotal,
} = require("../../utils/metrics");

describe("Observability & Metrics Engine", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: "GET",
      baseUrl: "/listings",
      path: "/507f1f77bcf86cd799439011",
      route: { path: "/:id" },
    };
    res = {
      statusCode: 200,
      on: jest.fn((event, callback) => {
        if (event === "finish") {
          callback();
        }
      }),
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    next = jest.fn();
  });

  test("metricsMiddleware captures request method, route, and increments counter", () => {
    metricsMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));
  });

  test("metricsHandler formats Prometheus 0.0.4 text output", () => {
    metricsHandler(req, res);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "text/plain; version=0.0.4; charset=utf-8"
    );
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining("http_requests_total")
    );
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining("process_uptime_seconds")
    );
  });

  test("tracks custom business metrics for payments", () => {
    paymentTotal.inc({ method: "upi", status: "success" });
    const promText = paymentTotal.toPrometheus();
    expect(promText).toContain('payment_total{method="upi",status="success"}');
  });
});

