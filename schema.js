const Joi = require('joi');
const review = require('./models/review');

module.exports.listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        location: Joi.string().required(),
        country: Joi.string().required(),
        price: Joi.number().required().min(0),
        image: Joi.string().allow("", null),
        category: Joi.string().valid(
            "trending", "rooms", "iconic_cities", "mountains", "castles",
            "pools", "camping", "farms", "arctic", "pg_hostel"
        ).allow("", null),
        // Feature #13: Amenities
        amenities: Joi.array().items(Joi.string().valid(
            "wifi", "ac", "kitchen", "parking", "pool", "tv", "washer", "dryer",
            "heating", "gym", "elevator", "balcony", "garden", "bbq", "hot_tub",
            "fireplace", "workspace", "pet_friendly", "security_camera", "smoke_alarm"
        )).default([]),
        // Feature #23: Room Details
        maxGuests: Joi.number().integer().min(1).max(50).default(2),
        bedrooms: Joi.number().integer().min(0).max(50).default(1),
        bathrooms: Joi.number().integer().min(0).max(50).default(1),
        beds: Joi.number().integer().min(0).max(50).default(1),
        // Feature #17: Dynamic Pricing
        weekendPrice: Joi.number().min(0).allow("", null),
    }).required(),
});

module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        comment: Joi.string().required(),
        ratings: Joi.object({
            cleanliness: Joi.number().integer().min(1).max(5).required(),
            accuracy: Joi.number().integer().min(1).max(5).required(),
            communication: Joi.number().integer().min(1).max(5).required(),
            location: Joi.number().integer().min(1).max(5).required(),
            value: Joi.number().integer().min(1).max(5).required(),
            checkIn: Joi.number().integer().min(1).max(5).required()
        }).required()
    }).required()
})