/**
 * System Design Pattern: Circuit Breaker
 * Protects RoamHaven from cascading failures when third-party services (Gemini AI, OpenCage) degrade.
 *
 * State Machine:
 * - CLOSED: Normal operation. Requests pass through. Failures increment failureCount.
 * - OPEN: Trip threshold exceeded (e.g., 5 consecutive failures). Fail-fast with local fallback in 1ms.
 * - HALF_OPEN: Cooldown period elapsed (e.g., 30s). Allow 1 test probe. If success -> CLOSED; if fail -> OPEN.
 */

const logger = require("./logger");

class CircuitBreaker {
  constructor({
    name = "ExternalService",
    failureThreshold = 5,
    cooldownPeriodMs = 30000,
    timeoutMs = 5000,
  } = {}) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.cooldownPeriodMs = cooldownPeriodMs;
    this.timeoutMs = timeoutMs;

    this.state = "CLOSED"; // CLOSED | OPEN | HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(primaryAction, fallbackAction = null) {
    if (this.state === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime > this.cooldownPeriodMs) {
        logger.info(`CircuitBreaker [${this.name}]: Cooldown elapsed. Entering HALF_OPEN state.`);
        this.state = "HALF_OPEN";
      } else {
        logger.warn(
          `CircuitBreaker [${this.name}]: Circuit is OPEN. Failing fast with fallback.`
        );
        if (typeof fallbackAction === "function") {
          return await fallbackAction(new Error(`Circuit [${this.name}] is OPEN (fast-fail)`));
        }
        throw new Error(`CircuitBreaker [${this.name}] is currently OPEN. Service unavailable.`);
      }
    }

    try {
      // Execute primary action with timeout enforcement
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`CircuitBreaker [${this.name}]: Request timed out`)), this.timeoutMs)
      );

      const result = await Promise.race([primaryAction(), timeoutPromise]);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      if (typeof fallbackAction === "function") {
        logger.info(`CircuitBreaker [${this.name}]: Primary failed, invoking fallback.`);
        return await fallbackAction(err);
      }
      throw err;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === "HALF_OPEN") {
      logger.info(`CircuitBreaker [${this.name}]: Probe succeeded. Circuit is now CLOSED.`);
      this.state = "CLOSED";
    }
  }

  onFailure(err) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    logger.error(`CircuitBreaker [${this.name}]: Failure recorded (${this.failureCount}/${this.failureThreshold}): ${err.message}`);

    if (this.failureCount >= this.failureThreshold || this.state === "HALF_OPEN") {
      this.state = "OPEN";
      logger.error(`CircuitBreaker [${this.name}]: Trip threshold reached. Circuit is now OPEN.`);
    }
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// Pre-configured circuit breakers for external third-party integrations
const geminiCircuitBreaker = new CircuitBreaker({
  name: "GoogleGeminiAI",
  failureThreshold: 3,
  cooldownPeriodMs: 20000,
  timeoutMs: 8000,
});

const geocoderCircuitBreaker = new CircuitBreaker({
  name: "OpenCageGeocoder",
  failureThreshold: 4,
  cooldownPeriodMs: 30000,
  timeoutMs: 4000,
});

module.exports = {
  CircuitBreaker,
  geminiCircuitBreaker,
  geocoderCircuitBreaker,
};

