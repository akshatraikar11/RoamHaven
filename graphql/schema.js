const { gql } = require("graphql-tag");
const Listing = require("../models/listing");
const Booking = require("../models/booking");

const typeDefs = gql`
  type Listing {
    id: ID!
    title: String!
    description: String
    price: Float
    location: String
    country: String
    category: String
  }

  type Booking {
    id: ID!
    listing: Listing!
    startDate: String!
    endDate: String!
    status: String
    totalAmount: Float
  }

  type User {
    id: ID!
    username: String!
    email: String!
    role: String!
  }

  type Query {
    listings: [Listing!]!
    listing(id: ID!): Listing
    me: User
    myBookings: [Booking!]!
  }
`;

const resolvers = {
  Query: {
    listings: async () => {
      const docs = await Listing.find({}).limit(100);
      return docs;
    },
    listing: async (_, { id }) => {
      return Listing.findById(id);
    },
    me: async (_, __, ctx) => {
      const user = ctx.user;
      if (!user) return null;
      return {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      };
    },
    myBookings: async (_, __, ctx) => {
      const user = ctx.user;
      if (!user) return [];
      const bookings = await Booking.find({ user: user._id })
        .populate("listing")
        .sort({ createdAt: -1 })
        .limit(100);
      return bookings;
    },
  },
  Booking: {
    id: (b) => b._id,
    listing: (b) => b.listing,
    startDate: (b) => (b.startDate ? b.startDate.toISOString() : null),
    endDate: (b) => (b.endDate ? b.endDate.toISOString() : null),
    status: (b) => b.status,
    totalAmount: (b) => (b.totalAmount != null ? b.totalAmount / 100 : null),
  },
  Listing: {
    id: (l) => l._id,
  },
};

module.exports = { typeDefs, resolvers };

