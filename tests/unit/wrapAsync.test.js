const wrapAsync = require("../../utils/wrapAsync");
const { InternalServerError } = require("../../utils/ExpressError");

describe("wrapAsync", () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {};
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("calls the wrapped function with req, res, next", async () => {
    const fn = jest.fn().mockResolvedValue("success");
    const wrapped = wrapAsync(fn);

    await wrapped(req, res, next);

    expect(fn).toHaveBeenCalledWith(req, res, next);
  });

  test("does not call next when function resolves successfully", async () => {
    const fn = jest.fn().mockResolvedValue("success");
    const wrapped = wrapAsync(fn);

    await wrapped(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  test("passes operational errors to next", async () => {
    const error = new Error("Operational error");
    error.isOperational = true;
    const fn = jest.fn().mockRejectedValue(error);
    const wrapped = wrapAsync(fn);

    await wrapped(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  test("wraps non-operational errors in InternalServerError", async () => {
    const error = new Error("Non-operational error");
    const fn = jest.fn().mockRejectedValue(error);
    const wrapped = wrapAsync(fn);

    await wrapped(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(InternalServerError));
    expect(next.mock.calls[0][0].message).toContain("Non-operational error");
  });

  test("uses generic message in production for non-operational errors", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const error = new Error("Non-operational error");
    const fn = jest.fn().mockRejectedValue(error);
    const wrapped = wrapAsync(fn);

    await wrapped(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(InternalServerError));
    expect(next.mock.calls[0][0].message).toBe("An unexpected error occurred");
    process.env.NODE_ENV = originalEnv;
  });
});
