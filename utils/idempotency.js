/**
 * System Design Pattern: Idempotency Key Middleware
 * Ensures financial & booking mutations are executed exactly once per unique key.
 *
 * Request Lifecycle:
 * 1. Checks `Idempotency-Key` HTTP header.
 * 2. If already COMPLETED: Returns cached status code and response body with `X-Idempotent-Replay: true`.
 * 3. If IN_PROGRESS: Returns 409 Conflict (prevents concurrent race conditions).
 * 4. If NEW: Locks key for 120s, intercepts response, caches final payload for 24h, and releases lock.
 */

const { getJSON, setJSON } = require("./cache");
const logger = require("./logger");

const memoryIdempotencyStore = new Map();

async function getIdempotencyRecord(key) {
  try {
    const cached = await getJSON(`idempotency:${key}`);
    if (cached) return cached;
  } catch (_e) {}
  return memoryIdempotencyStore.get(key) || null;
}

async function setIdempotencyRecord(key, record, ttlSeconds = 86400) {
  try {
    await setJSON(`idempotency:${key}`, record, ttlSeconds);
  } catch (_e) {}
  memoryIdempotencyStore.set(key, record);
}

function idempotencyMiddleware({ required = false, ttlSeconds = 86400 } = {}) {
  return async (req, res, next) => {
    // Only apply to mutating requests (POST, PUT, PATCH, DELETE)
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers["idempotency-key"] || req.body?.idempotencyKey;

    if (!idempotencyKey) {
      if (required) {
        return res.status(400).json({
          error: "Idempotency-Key header is required for this transactional endpoint.",
        });
      }
      return next();
    }

    const scopedKey = `${req.user ? req.user._id : "anon"}:${idempotencyKey}:${req.originalUrl}`;
    const existing = await getIdempotencyRecord(scopedKey);

    if (existing) {
      if (existing.status === "IN_PROGRESS") {
        logger.warn(`Idempotency conflict for key: ${idempotencyKey}`);
        return res.status(409).json({
          error: "An identical request is currently being processed. Please wait.",
        });
      }

      if (existing.status === "COMPLETED") {
        logger.info(`Idempotent replay served for key: ${idempotencyKey}`);
        res.setHeader("X-Idempotent-Replay", "true");
        if (existing.headers) {
          Object.entries(existing.headers).forEach(([h, v]) => res.setHeader(h, v));
        }
        return res.status(existing.statusCode).send(existing.body);
      }
    }

    // Mark as IN_PROGRESS with 120-second lock
    await setIdempotencyRecord(scopedKey, { status: "IN_PROGRESS", createdAt: Date.now() }, 120);

    // Intercept response methods to cache final response upon completion
    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);

    res.send = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setIdempotencyRecord(
          scopedKey,
          {
            status: "COMPLETED",
            statusCode: res.statusCode,
            body: body,
            completedAt: Date.now(),
          },
          ttlSeconds
        );
      }
      return originalSend(body);
    };

    res.json = function (jsonBody) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setIdempotencyRecord(
          scopedKey,
          {
            status: "COMPLETED",
            statusCode: res.statusCode,
            body: jsonBody,
            completedAt: Date.now(),
          },
          ttlSeconds
        );
      }
      return originalJson(jsonBody);
    };

    next();
  };
}

module.exports = {
  idempotencyMiddleware,
  getIdempotencyRecord,
  setIdempotencyRecord,
};

