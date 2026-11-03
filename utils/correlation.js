const crypto = require('crypto');

/**
 * @module correlation
 * @description Request correlation ID middleware for distributed tracing
 */

/**
 * Generate a unique correlation ID
 * @returns {string} Unique correlation ID
 */
function generateCorrelationId() {
  return crypto.randomUUID();
}

/**
 * Middleware to add correlation ID to requests
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
function correlationMiddleware(req, res, next) {
  // Check if correlation ID exists in headers
  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  
  // Add to request and response
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  next();
}

module.exports = {
  generateCorrelationId,
  correlationMiddleware,
};
