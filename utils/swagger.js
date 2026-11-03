const swaggerJsdoc = require('swagger-jsdoc');

/**
 * @module swagger
 * @description Swagger/OpenAPI configuration for API documentation
 */

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RoamHaven API',
      version: '1.0.0',
      description: 'API documentation for RoamHaven - a vacation rental platform',
      contact: {
        name: 'API Support',
        email: 'support@roamhaven.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: 'Development server',
      },
      {
        url: process.env.API_URL || 'https://api.roamhaven.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'roamhaven.sid',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            statusCode: {
              type: 'integer',
              description: 'HTTP status code',
            },
            correlationId: {
              type: 'string',
              description: 'Request correlation ID for tracing',
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        Listing: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            location: { type: 'string' },
            country: { type: 'string' },
            price: { type: 'number' },
            category: {
              type: 'string',
              enum: ['trending', 'rooms', 'iconic_cities', 'mountains', 'castles', 'pools', 'camping', 'farms', 'arctic', 'pg_hostel'],
            },
            amenities: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['wifi', 'ac', 'kitchen', 'parking', 'pool', 'tv', 'washer', 'dryer', 'heating', 'gym', 'elevator', 'balcony', 'garden', 'bbq', 'hot_tub', 'fireplace', 'workspace', 'pet_friendly', 'security_camera', 'smoke_alarm'],
              },
            },
            maxGuests: { type: 'number' },
            bedrooms: { type: 'number' },
            bathrooms: { type: 'number' },
            beds: { type: 'number' },
            image: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                filename: { type: 'string' },
              },
            },
            geometry: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['Point'] },
                coordinates: {
                  type: 'array',
                  items: { type: 'number' },
                },
              },
            },
          },
        },
        Review: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            rating: { type: 'number', minimum: 1, maximum: 5 },
            comment: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Booking: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            listing: { type: 'string' },
            user: { type: 'string' },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            guests: { type: 'number' },
            totalAmount: { type: 'number' },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'cancelled', 'completed'],
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Listings',
        description: 'Listing management endpoints',
      },
      {
        name: 'Reviews',
        description: 'Review management endpoints',
      },
      {
        name: 'Bookings',
        description: 'Booking management endpoints',
      },
      {
        name: 'Users',
        description: 'User authentication and profile endpoints',
      },
      {
        name: 'AI',
        description: 'AI-powered features endpoints',
      },
      {
        name: 'Health',
        description: 'System health check endpoints',
      },
    ],
  },
  apis: ['./routes/*.js', './controllers/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
