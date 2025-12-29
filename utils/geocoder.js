const NodeGeocoder = require("node-geocoder");

const options = {
  provider: "locationiq",
  apiKey: process.env.LOCATIONIQ_KEY,
  formatter: null,
};

const geocoder = NodeGeocoder(options);

module.exports = geocoder;
