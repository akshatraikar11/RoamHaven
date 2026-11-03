const Joi = require('joi');

/**
 * @module validators
 * @description Joi validation schemas for API endpoints
 */

/**
 * Common validation patterns
 */
const commonPatterns = {
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
  objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  date: Joi.date().iso().required(),
  url: Joi.string().uri(),
};

/**
 * Listing validation schemas
 */
const listingSchemas = {
  create: Joi.object({
    listing: Joi.object({
      title: Joi.string().min(5).max(100).required(),
      description: Joi.string().min(20).max(2000).required(),
      location: Joi.string().min(2).max(100).required(),
      country: Joi.string().min(2).max(100).required(),
      price: Joi.number().positive().required(),
      category: Joi.string().valid(
        'trending', 'rooms', 'iconic_cities', 'mountains', 'castles',
        'pools', 'camping', 'farms', 'arctic', 'pg_hostel'
      ).required(),
      maxGuests: Joi.number().integer().min(1).max(20).default(2),
      bedrooms: Joi.number().integer().min(0).default(1),
      bathrooms: Joi.number().integer().min(0).default(1),
      beds: Joi.number().integer().min(0).default(1),
      amenities: Joi.array().items(
        Joi.string().valid(
          'wifi', 'ac', 'kitchen', 'parking', 'pool', 'tv', 'washer',
          'dryer', 'heating', 'gym', 'elevator', 'balcony', 'garden',
          'bbq', 'hot_tub', 'fireplace', 'workspace', 'pet_friendly',
          'security_camera', 'smoke_alarm'
        )
      ).default([]),
      weekendPrice: Joi.number().positive().optional(),
      seasonalPricing: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          startDate: commonPatterns.date,
          endDate: commonPatterns.date,
          price: Joi.number().positive().required(),
        })
      ).optional(),
    }).required(),
  }),

  update: Joi.object({
    listing: Joi.object({
      title: Joi.string().min(5).max(100).optional(),
      description: Joi.string().min(20).max(2000).optional(),
      location: Joi.string().min(2).max(100).optional(),
      country: Joi.string().min(2).max(100).optional(),
      price: Joi.number().positive().optional(),
      category: Joi.string().valid(
        'trending', 'rooms', 'iconic_cities', 'mountains', 'castles',
        'pools', 'camping', 'farms', 'arctic', 'pg_hostel'
      ).optional(),
      maxGuests: Joi.number().integer().min(1).max(20).optional(),
      bedrooms: Joi.number().integer().min(0).optional(),
      bathrooms: Joi.number().integer().min(0).optional(),
      beds: Joi.number().integer().min(0).optional(),
      amenities: Joi.array().items(
        Joi.string().valid(
          'wifi', 'ac', 'kitchen', 'parking', 'pool', 'tv', 'washer',
          'dryer', 'heating', 'gym', 'elevator', 'balcony', 'garden',
          'bbq', 'hot_tub', 'fireplace', 'workspace', 'pet_friendly',
          'security_camera', 'smoke_alarm'
        )
      ).optional(),
      weekendPrice: Joi.number().positive().optional(),
      seasonalPricing: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          startDate: commonPatterns.date,
          endDate: commonPatterns.date,
          price: Joi.number().positive().required(),
        })
      ).optional(),
    }).required(),
  }),

  search: Joi.object({
    q: Joi.string().max(200).optional(),
    location: Joi.string().max(100).optional(),
    minPrice: Joi.number().min(0).optional(),
    maxPrice: Joi.number().min(0).optional(),
    category: Joi.string().valid(
      'trending', 'rooms', 'iconic_cities', 'mountains', 'castles',
      'pools', 'camping', 'farms', 'arctic', 'pg_hostel', 'all'
    ).optional(),
    amenities: Joi.string().optional(),
    sort: Joi.string().valid('price_asc', 'price_desc', 'newest', 'rating').optional(),
    minRating: Joi.number().min(1).max(5).optional(),
    maxGuests: Joi.number().integer().min(1).max(20).optional(),
    collection: Joi.string().valid('monsoon_getaways', 'winter_cabins', 'summer_beach').optional(),
  }),

  dynamicPrice: Joi.object({
    checkIn: commonPatterns.date,
    checkOut: commonPatterns.date,
  }),

  availability: Joi.object({
    date: commonPatterns.date,
    action: Joi.string().valid('block', 'unblock').required(),
  }),

  priceAlert: Joi.object({
    targetPrice: Joi.number().positive().required(),
  }),
};

/**
 * Booking validation schemas
 */
const bookingSchemas = {
  create: Joi.object({
    listingId: commonPatterns.objectId,
    startDate: commonPatterns.date,
    endDate: commonPatterns.date,
    guests: Joi.number().integer().min(1).max(20).required(),
  }),

  applyCoupon: Joi.object({
    listingId: commonPatterns.objectId,
    startDate: commonPatterns.date,
    endDate: commonPatterns.date,
    couponCode: Joi.string().uppercase().min(3).max(20).required(),
  }),

  payment: Joi.object({
    bookingId: commonPatterns.objectId,
    razorpay_order_id: Joi.string().required(),
    razorpay_payment_id: Joi.string().required(),
    razorpay_signature: Joi.string().required(),
  }),
};

/**
 * Review validation schemas
 */
const reviewSchemas = {
  create: Joi.object({
    review: Joi.object({
      rating: Joi.number().integer().min(1).max(5).required(),
      comment: Joi.string().min(10).max(1000).required(),
      ratings: Joi.object({
        cleanliness: Joi.number().integer().min(1).max(5).required(),
        accuracy: Joi.number().integer().min(1).max(5).required(),
        communication: Joi.number().integer().min(1).max(5).required(),
        location: Joi.number().integer().min(1).max(5).required(),
        value: Joi.number().integer().min(1).max(5).required(),
        checkIn: Joi.number().integer().min(1).max(5).required(),
      }).optional(),
    }).required(),
  }),
};

/**
 * User validation schemas
 */
const userSchemas = {
  signup: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: commonPatterns.email,
    password: commonPatterns.password,
  }),

  login: Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
  }),

  forgotPassword: Joi.object({
    email: commonPatterns.email,
  }),

  resetPassword: Joi.object({
    password: commonPatterns.password,
    confirmPassword: Joi.ref('password'),
  }).with('password', 'confirmPassword'),

  updateProfile: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).optional(),
    email: Joi.string().email().optional(),
    bio: Joi.string().max(500).optional(),
  }),
};

/**
 * Chat validation schemas
 */
const chatSchemas = {
  message: Joi.object({
    message: Joi.string().min(1).max(1000).required(),
    history: Joi.array().items(
      Joi.object({
        role: Joi.string().valid('user', 'assistant').required(),
        content: Joi.string().required(),
      })
    ).max(10).optional(),
  }),
};

/**
 * Validation middleware factory
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} property - Request property to validate (body, query, params)
 * @returns {Function} Express middleware function
 */
function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        errors,
        correlationId: req.correlationId,
      });
    }

    req[property] = value;
    next();
  };
}

module.exports = {
  listingSchemas,
  bookingSchemas,
  reviewSchemas,
  userSchemas,
  chatSchemas,
  validate,
};
