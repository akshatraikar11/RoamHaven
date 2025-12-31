if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}
console.log("🚀 Server Starting...");
console.log("🔑 Google API Key Status:", process.env.GOOGLE_API_KEY ? "Loaded ✅" : "Missing ❌");
console.log("💽 DB URL:", process.env.ATLASDB_URL ? "Loaded from Env" : "Using Local Fallback");

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const axios = require("axios");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

// Use Atlas URL from environment when available, otherwise fall back to local MongoDB
const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/roamhaven";

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });
async function main() {
  await mongoose.connect(dbUrl);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 3600,
});

store.on("error", () => {
  console.log("Error in MONGO SESSION STORE", err);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

// Root route: redirect to listings index
app.get("/", (req, res) => {
  res.redirect("/listings");
});

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const GoogleStrategy = require("passport-google-oauth20").Strategy;

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
          return done(null, user);
        } else {
          const newUser = new User({
            email: profile.emails[0].value,
            username: profile.displayName,
            googleId: profile.id,
          });
          user = await newUser.save();
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      }
    }
  )
);

app.use(session(sessionOptions)); // session setup
app.use(flash()); // flash setup

app.use(passport.initialize()); // passport init
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

const bookingRouter = require("./routes/bookings.js");

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);
app.use("/bookings", bookingRouter);

// app.all("*", (req, res, next) => {
//   next(new ExpressError(404, "Page Not Found"));
// });

// Simple Rule-Based Chatbot (No API needed)
app.post("/api/jarvis", async (req, res) => {
  try {
    const { message } = req.body;
    const Listing = require("./models/listing.js");

    const userMessage = message.toLowerCase().trim();
    let reply = "";

    // Greeting
    if (userMessage.match(/^(hi|hello|hey|good morning|good evening)/)) {
      reply = "👋 Hello! I'm RoamMate, your travel assistant. I can help you with:<br><br>" +
        "🏠 <b>Find listings</b> - Ask about places in any location<br>" +
        "💰 <b>Check prices</b> - Get pricing information<br>" +
        "📍 <b>Locations</b> - Explore different destinations<br>" +
        "❓ <b>Help & Support</b> - Get answers to common questions<br><br>" +
        "What would you like to know?";
    }

    // Search for listings by location
    else if (userMessage.match(/(show|find|search|list|looking for|need).*(listing|place|property|room|accommodation)/i) ||
      userMessage.match(/(nashik|mumbai|goa|delhi|bangalore|pune|india)/i)) {

      // Extract location if mentioned
      let location = null;
      const locations = ['nashik', 'mumbai', 'goa', 'delhi', 'bangalore', 'pune'];
      for (const loc of locations) {
        if (userMessage.includes(loc)) {
          location = loc;
          break;
        }
      }

      let listings;
      if (location) {
        listings = await Listing.find({
          location: new RegExp(location, 'i')
        }).limit(5).select("title price location country");
      } else {
        listings = await Listing.find({}).limit(5).select("title price location country");
      }

      if (listings.length > 0) {
        reply = location
          ? `🏠 Here are some amazing places in <b>${location.charAt(0).toUpperCase() + location.slice(1)}</b>:<br><br>`
          : "🏠 Here are some of our top listings:<br><br>";

        listings.forEach((listing, index) => {
          reply += `${index + 1}. <b>${listing.title}</b><br>` +
            `   📍 ${listing.location}, ${listing.country}<br>` +
            `   💰 ₹${listing.price.toLocaleString('en-IN')}/night<br><br>`;
        });

        reply += "Visit our <a href='/listings'>listings page</a> to see all available properties!";
      } else {
        reply = "😔 Sorry, I couldn't find any listings matching your search. Try browsing our <a href='/listings'>all listings</a>!";
      }
    }

    // Price information
    else if (userMessage.match(/(price|cost|expensive|cheap|budget|affordable)/i)) {
      const stats = await Listing.aggregate([
        {
          $group: {
            _id: null,
            avgPrice: { $avg: "$price" },
            minPrice: { $min: "$price" },
            maxPrice: { $max: "$price" }
          }
        }
      ]);

      if (stats.length > 0) {
        const { avgPrice, minPrice, maxPrice } = stats[0];
        reply = "💰 <b>Pricing Information:</b><br><br>" +
          `📊 Average: ₹${Math.round(avgPrice).toLocaleString('en-IN')}/night<br>` +
          `💵 Starting from: ₹${minPrice.toLocaleString('en-IN')}/night<br>` +
          `💎 Up to: ₹${maxPrice.toLocaleString('en-IN')}/night<br><br>` +
          "We have options for every budget! Check out our <a href='/listings'>listings</a> to find your perfect stay.";
      }
    }

    // Booking help
    else if (userMessage.match(/(book|reserve|reservation|how to book)/i)) {
      reply = "📅 <b>How to Book:</b><br><br>" +
        "1️⃣ Browse our <a href='/listings'>listings</a><br>" +
        "2️⃣ Click on a property you like<br>" +
        "3️⃣ Click the <b>'Reserve'</b> button<br>" +
        "4️⃣ Fill in your details and dates<br>" +
        "5️⃣ Complete payment securely<br><br>" +
        "✅ You'll receive confirmation within 24 hours!";
    }

    // Cancellation policy
    else if (userMessage.match(/(cancel|refund|cancellation policy)/i)) {
      reply = "🔄 <b>Cancellation Policy:</b><br><br>" +
        "✅ <b>Free cancellation</b> within 24 hours of booking<br>" +
        "⏰ After 24 hours, cancellation depends on the host's policy<br>" +
        "💰 Full refund if booking isn't confirmed by host<br><br>" +
        "For specific property policies, check the listing details page.";
    }

    // Contact/Support
    else if (userMessage.match(/(contact|support|help|customer service|email|phone)/i)) {
      reply = "📞 <b>Customer Support:</b><br><br>" +
        "📧 Email: support@roamhaven.com<br>" +
        "📱 Phone: +91 1234567890<br>" +
        "⏰ Available: 24/7<br><br>" +
        "We're here to help! Feel free to reach out anytime.";
    }

    // Categories
    else if (userMessage.match(/(category|type|trending|popular|iconic|mountain|beach)/i)) {
      const categories = await Listing.distinct("category");
      reply = "🏷️ <b>Browse by Category:</b><br><br>";

      const categoryIcons = {
        'trending': '🔥',
        'rooms': '🛏️',
        'iconic_cities': '🏙️',
        'mountains': '⛰️',
        'castles': '🏰',
        'pools': '🏊',
        'camping': '⛺',
        'farms': '🌾',
        'arctic': '❄️'
      };

      categories.forEach(cat => {
        const icon = categoryIcons[cat] || '📍';
        reply += `${icon} ${cat.replace('_', ' ').toUpperCase()}<br>`;
      });

      reply += "<br>Visit our <a href='/listings'>listings page</a> and use the filters to explore!";
    }

    // Thank you
    else if (userMessage.match(/(thank|thanks|appreciate)/i)) {
      reply = "😊 You're welcome! Happy to help. If you have any other questions, just ask!<br><br>" +
        "Safe travels! 🌍✈️";
    }

    // Goodbye
    else if (userMessage.match(/(bye|goodbye|see you|later)/i)) {
      reply = "👋 Goodbye! Thanks for chatting with RoamMate. Have a wonderful day and happy travels! 🌟";
    }

    // Default response
    else {
      reply = "🤔 I'm not sure I understand. I can help you with:<br><br>" +
        "🏠 Finding listings in specific locations<br>" +
        "💰 Price information<br>" +
        "📅 Booking process<br>" +
        "🔄 Cancellation policies<br>" +
        "📞 Customer support<br>" +
        "🏷️ Browse categories<br><br>" +
        "What would you like to know?";
    }

    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      reply: "😔 Sorry, I'm having trouble right now. Please try again or contact our support team at support@roamhaven.com"
    });
  }
});

app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something went wrong" } = err;
  res.status(statusCode).render("error", { message });
  //   res.status(statusCode).send(message);
});





app.listen(8080, () => {
  console.log("server is listening to port 8080");
});
