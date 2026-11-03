const crypto = require('crypto');

/**
 * Generate a random CSRF token
 */
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF protection middleware
 * Generates a token and stores it in session, validates on POST/PUT/DELETE
 */
function csrfProtection(req, res, next) {
  // Skip CSRF for API routes that use other auth mechanisms
  if (req.path.startsWith('/api/') || req.path.startsWith('/graphql')) {
    return next();
  }

  // Generate token if not exists
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCSRFToken();
  }

  // Make token available to views
  res.locals.csrfToken = req.session.csrfToken;

  // Validate token for state-changing methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.body._csrf || req.headers['x-csrf-token'];
    
    if (!token || token !== req.session.csrfToken) {
      return res.status(403).json({
        error: 'Invalid CSRF token',
        message: 'CSRF token validation failed. Please refresh the page and try again.',
      });
    }

    // Regenerate token after successful validation
    req.session.csrfToken = generateCSRFToken();
    res.locals.csrfToken = req.session.csrfToken;
  }

  next();
}

module.exports = {
  generateCSRFToken,
  csrfProtection,
};
