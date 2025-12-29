if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

// Use Atlas URL from environment when available
const MONGO_URL = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/roamheavn";

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
  await Listing.deleteMany({});

  // Import User model and geocoder
  const User = require("../models/user.js");
  const geocoder = require("../utils/geocoder.js");

  // Check if default user exists, if not, create one
  let defaultUser = await User.findOne({ username: "defaultowner" });

  if (!defaultUser) {
    defaultUser = new User({
      email: "owner@roamhaven.com",
      username: "defaultowner"
    });
    // Set password using passport-local-mongoose method
    await User.register(defaultUser, "defaultpassword123");
    console.log("Default owner user created");
  }

  // Process each listing to add geocoded coordinates
  console.log("Geocoding listings...");
  const preparedData = [];

  for (const obj of initData.data) {
    try {
      // Geocode the location
      const geoData = await geocoder.geocode(obj.location);

      let coordinates = [0, 0]; // default fallback
      if (geoData && geoData.length > 0) {
        coordinates = [geoData[0].longitude, geoData[0].latitude];
      }

      preparedData.push({
        ...obj,
        owner: defaultUser._id,
        geometry: {
          type: "Point",
          coordinates: coordinates,
        },
      });
    } catch (err) {
      console.log(`Failed to geocode ${obj.location}, using default coordinates`);
      preparedData.push({
        ...obj,
        owner: defaultUser._id,
        geometry: {
          type: "Point",
          coordinates: [0, 0],
        },
      });
    }
  }

  await Listing.insertMany(preparedData);
  console.log("Data was initialized with geocoded coordinates");
  process.exit();
};

initDB();
