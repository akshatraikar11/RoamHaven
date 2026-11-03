const { InternalServerError } = require('./ExpressError');

/**
 * Wraps async route handlers to catch errors and pass them to Express error handling
 * @param {Function} fn - Async function to wrap (req, res, next) => Promise
 * @returns {Function} Express middleware function
 */
module.exports = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next))
            .catch((err) => {
                // If it's not an operational error, wrap it in InternalServerError
                if (!err.isOperational) {
                    console.error('Unhandled error in wrapAsync:', err);
                    return next(new InternalServerError(
                        process.env.NODE_ENV === 'production' 
                            ? 'An unexpected error occurred' 
                            : err.message
                    ));
                }
                next(err);
            });
    };
};