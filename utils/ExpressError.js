/**
 * @class ExpressError
 * @extends Error
 * @description Base error class for application-specific errors
 * @property {number} statusCode - HTTP status code
 * @property {string} message - Error message
 * @property {Array|null} errors - Detailed validation errors
 * @property {boolean} isOperational - Whether error is operational (expected) or programming error
 */
class ExpressError extends Error {
    /**
     * @param {number} statusCode - HTTP status code
     * @param {string} message - Error message
     * @param {Array|null} errors - Detailed validation errors
     */
    constructor(statusCode, message, errors = null) {
        super();
        this.statusCode = statusCode;
        this.message = message;
        this.errors = errors;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * @class ValidationError
 * @extends ExpressError
 * @description Error for validation failures (400)
 */
class ValidationError extends ExpressError {
    /**
     * @param {string} message - Error message
     * @param {Array|null} errors - Detailed validation errors
     */
    constructor(message, errors = null) {
        super(400, message, errors);
        this.name = 'ValidationError';
    }
}

/**
 * @class AuthenticationError
 * @extends ExpressError
 * @description Error for authentication failures (401)
 */
class AuthenticationError extends ExpressError {
    /**
     * @param {string} message - Error message
     */
    constructor(message = 'Authentication required') {
        super(401, message);
        this.name = 'AuthenticationError';
    }
}

/**
 * @class AuthorizationError
 * @extends ExpressError
 * @description Error for authorization failures (403)
 */
class AuthorizationError extends ExpressError {
    /**
     * @param {string} message - Error message
     */
    constructor(message = 'You do not have permission to perform this action') {
        super(403, message);
        this.name = 'AuthorizationError';
    }
}

/**
 * @class NotFoundError
 * @extends ExpressError
 * @description Error for resource not found (404)
 */
class NotFoundError extends ExpressError {
    /**
     * @param {string} message - Error message
     */
    constructor(message = 'Resource not found') {
        super(404, message);
        this.name = 'NotFoundError';
    }
}

/**
 * @class ConflictError
 * @extends ExpressError
 * @description Error for resource conflicts (409)
 */
class ConflictError extends ExpressError {
    /**
     * @param {string} message - Error message
     */
    constructor(message = 'Resource conflict') {
        super(409, message);
        this.name = 'ConflictError';
    }
}

/**
 * @class RateLimitError
 * @extends ExpressError
 * @description Error for rate limit exceeded (429)
 */
class RateLimitError extends ExpressError {
    /**
     * @param {string} message - Error message
     */
    constructor(message = 'Too many requests, please try again later') {
        super(429, message);
        this.name = 'RateLimitError';
    }
}

/**
 * @class InternalServerError
 * @extends ExpressError
 * @description Error for internal server errors (500)
 */
class InternalServerError extends ExpressError {
    /**
     * @param {string} message - Error message
     */
    constructor(message = 'Internal server error') {
        super(500, message);
        this.name = 'InternalServerError';
        this.isOperational = false;
    }
}

module.exports = {
    ExpressError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    InternalServerError,
};