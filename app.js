if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const {
  ExpressError,
  NotFoundError,
} = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const Wallet = require("./models/wallet.js");
const Notification = require("./models/notification.js");
const axios = require("axios");
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const { typeDefs, resolvers } = require("./graphql/schema.js");
const { initCache } = require("./utils/cache.js");
const { generalLimiter, authLimiter, apiLimiter } = require("./utils/rateLimiters.js");
const { csrfProtection } = require("./utils/csrf.js");
const logger = require("./utils/logger.js");
const { correlationMiddleware } = require("./utils/correlation.js");
const { metricsMiddleware, metricsHandler } = require("./utils/metrics.js");
const swaggerSpec = require("./utils/swagger.js");
const swaggerUi = require("swagger-ui-express");
const {
  trackSocketConnect,
  trackSocketDisconnect,
  emitAdminAnalytics,
} = require("./utils/analytics.js");

logger.info("🚀 Server Starting...");
logger.info(`🔑 Google API Key Status: ${process.env.GOOGLE_API_KEY ? "Loaded ✅" : "Missing ❌"}`);
logger.info(`💽 DB URL: ${process.env.ATLASDB_URL ? "Loaded from Env" : "Using Local Fallback"}`);

const helmet = require("helmet");

// Feature #58: Realtime notifications (Socket.io)
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});
app.locals.io = io;

io.on("connection", (socket) => {
  trackSocketConnect();
  emitAdminAnalytics(io).catch(() => {});

  const userId = socket.handshake.query?.userId;
  if (userId) {
    socket.join(`user:${String(userId)}`);
  }

  socket.on("admin:analytics:subscribe", () => {
    socket.join("admin:analytics");
    emitAdminAnalytics(io).catch(() => {});
  });

  socket.on("disconnect", () => {
    trackSocketDisconnect();
    emitAdminAnalytics(io).catch(() => {});
  });
});

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const wishlistRouter = require("./routes/wishlist.js");

// Use Atlas URL from environment when available, otherwise fall back to local MongoDB
const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/roamhaven";

main()
  .then(() => {
    logger.info("connected to DB");
  })
  .catch((err) => {
    logger.error("DB connection error:", err);
  });
async function main() {
  await mongoose.connect(dbUrl);
  await initCache();
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://unpkg.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://unpkg.com",
        ],
        fontSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
          "data:",
        ],
        connectSrc: ["'self'", "ws:", "wss:", "https:"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'", "https://www.google.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(correlationMiddleware);
app.use(metricsMiddleware);
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(generalLimiter);

// Security: sanitize query/body/params against NoSQL injection & XSS
function sanitizeNoSqlPayload(input) {
  if (!input || typeof input !== "object") return;
  if (Array.isArray(input)) {
    input.forEach((item) => sanitizeNoSqlPayload(item));
    return;
  }

  for (const key of Object.keys(input)) {
    const value = input[key];
    const sanitizedKey = key.replaceAll("$", "_").replaceAll(".", "_");
    if (sanitizedKey !== key) {
      delete input[key];
      input[sanitizedKey] = value;
    }
    sanitizeNoSqlPayload(input[sanitizedKey]);
  }
}

app.use((req, res, next) => {
  sanitizeNoSqlPayload(req.body);
  sanitizeNoSqlPayload(req.params);
  sanitizeNoSqlPayload(req.query);
  next();
});

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeStrings(input) {
  if (input == null) return;
  if (typeof input === "string") return escapeHtml(input);
  if (Array.isArray(input)) return input.map((v) => sanitizeStrings(v));
  if (typeof input !== "object") return input;

  for (const key of Object.keys(input)) {
    input[key] = sanitizeStrings(input[key]);
  }
  return input;
}

// Express 5-safe XSS hardening: mutate nested values, don't reassign req.query
app.use((req, res, next) => {
  sanitizeStrings(req.body);
  sanitizeStrings(req.params);
  sanitizeStrings(req.query);
  next();
});

const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 3600,
});

store.on("error", (err) => {
  console.log("Error in MONGO SESSION STORE", err);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Regenerate session ID on each request
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  },
  name: "roamhaven.sid", // Custom session cookie name for security
};

// Root route: redirect to listings index
app.get("/", (req, res) => {
  res.redirect("/listings");
});

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const GoogleStrategy = require("passport-google-oauth20").Strategy;

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
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
} else {
  logger.info("🔐 Google OAuth disabled — GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured");
}

app.use(session(sessionOptions)); // session setup
app.use(flash()); // flash setup
app.use(csrfProtection); // CSRF protection

app.use(passport.initialize()); // passport init
app.use(passport.session());

app.use(async (req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  res.locals.userRole = req.user ? req.user.role : null;
  res.locals.isEmailVerified = req.user ? req.user.isEmailVerified : false;
  res.locals.loyaltyPoints = req.user ? req.user.loyaltyPoints || 0 : 0;
  res.locals.userBadges = req.user ? req.user.badges || [] : [];
  res.locals.idVerificationStatus = req.user?.idVerification?.status || "unverified";
  res.locals.userFavorites = (req.user?.favorites || []).map((id) => String(id));
  res.locals.walletBalance = 0;
  res.locals.unreadNotificationCount = 0;

  try {
    if (req.user) {
      const [wallet, unreadCount] = await Promise.all([
        Wallet.findOne({ user: req.user._id }).select("balance").lean(),
        Notification.countDocuments({ user: req.user._id, isRead: false }),
      ]);
      res.locals.walletBalance = wallet ? wallet.balance : 0;
      res.locals.unreadNotificationCount = unreadCount;
    }
  } catch (_err) {
    // Non-critical: wallet/notifications are progressive enhancement.
    // Never block the request/response cycle on view-metadata failures.
  }

  next();
});

const bookingRouter = require("./routes/bookings.js");
const chatRouter = require("./routes/chat.js");
const notificationsRouter = require("./routes/notifications.js");
const walletRouter = require("./routes/wallet.js");
const adminRouter = require("./routes/admin.js");
const aiRouter = require("./routes/ai.js");
const revenueRouter = require("./routes/revenue.js");
const tripsRouter = require("./routes/trips.js");

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use(
  ["/login", "/signup", "/forgot-password", "/reset-password", "/auth/google"],
  authLimiter
);
app.use("/", userRouter);
app.use("/", wishlistRouter);
app.use("/bookings", bookingRouter);
app.use("/api", apiLimiter, chatRouter);
app.use("/api", apiLimiter, notificationsRouter);
app.use("/api", apiLimiter, aiRouter);
app.use("/wallet", walletRouter);
app.use("/admin", adminRouter);
app.use("/revenue", revenueRouter);
app.use("/trips", tripsRouter);

// Swagger API Documentation (only in development)
if (process.env.NODE_ENV !== "production") {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}

// Observability: Prometheus scrape endpoint for Kubernetes HPA & Grafana
app.get("/metrics", metricsHandler);

// Feature #122: Health check endpoint (used by Docker/K8s)
app.get("/api/health", (req, res) => {
  const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
  const dbState = mongoose.connection.readyState;
  res.status(dbState === 1 ? 200 : 503).json({
    status: dbState === 1 ? "ok" : "degraded",
    db: dbStates[dbState] || "unknown",
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: process.memoryUsage().rss,
      heapUsed: process.memoryUsage().heapUsed,
    },
    timestamp: new Date().toISOString(),
  });
});

// GraphQL endpoint (Feature #153)
async function startGraphQL() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => ({ user: req.user }),
  });
  await server.start();
  app.use("/graphql", apiLimiter, expressMiddleware(server));
}

// IMPORTANT: 404 + global error handlers MUST be registered AFTER
// startGraphQL() resolves. Apollo's app.use('/graphql') is async, and if we
// register NotFoundError before Apollo mounts its middleware, then 404 wins
// the Express ordering race and GraphQL endpoint always 404s.
startGraphQL()
  .catch((err) => {
    console.error("Failed to start GraphQL server", err);
  })
  .finally(() => {
    // 404 handler — registered after all route mounts, catches anything not matched above.
    // Express 5 note: plain `app.use` middleware avoids the path-to-regexp v7 strict parser
    // (bare `*` splat pattern is no longer valid; splats now require `:paramName*` syntax.)
    app.use((req, res, next) => {
      next(new NotFoundError("Page Not Found"));
    });

    // Global error handler
    app.use((err, req, res, next) => {
      // Log error for debugging
      if (process.env.NODE_ENV !== 'production' || !err.isOperational) {
        logger.error('Error:', {
          name: err.name,
          message: err.message,
          statusCode: err.statusCode,
          stack: err.stack,
          path: req.path,
          method: req.method,
          userId: req.user?._id,
          correlationId: req.correlationId,
        });
      }

      let { statusCode = 500, message = "Something went wrong", errors = null } = err;

      // Handle API requests differently
      if (req.path.startsWith('/api') || req.path.startsWith('/graphql')) {
        return res.status(statusCode).json({
          error: message,
          statusCode,
          correlationId: req.correlationId,
          ...(errors && { errors }),
          ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
        });
      }

      // Handle web requests
      if (statusCode >= 500) {
        req.flash("error", "Something went wrong. Please try again later.");
      } else if (statusCode === 404) {
        req.flash("error", message);
      } else if (statusCode === 401 || statusCode === 403) {
        req.flash("error", message);
      } else {
        req.flash("error", message);
      }

      res.status(statusCode).render("error", { message, statusCode });
    });
  });

module.exports = { app, server };

if (require.main === module) {
  server.listen(8080, () => {
    logger.info("server is listening to port 8080");
  });
}
