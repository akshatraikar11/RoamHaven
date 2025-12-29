const NodeGeocoder = require("node-geocoder");

const hasOpenCageKey = process.env.OPENCAGE_API_KEY && process.env.OPENCAGE_API_KEY.trim().length > 0;

const options = hasOpenCageKey
  ? {
    provider: "opencage",
    apiKey: process.env.OPENCAGE_API_KEY,
    formatter: null,
  }
  : {
    provider: "openstreetmap",
    formatter: null,
  };

const geocoder = NodeGeocoder(options);

module.exports = geocoder;
