const User = require("../models/user");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Payment = require("../models/payment");

let activeSocketCount = 0;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

module.exports.trackSocketConnect = () => {
  activeSocketCount += 1;
};

module.exports.trackSocketDisconnect = () => {
  activeSocketCount = Math.max(0, activeSocketCount - 1);
};

module.exports.getActiveSocketCount = () => activeSocketCount;

module.exports.getLiveStats = async () => {
  const today = startOfToday();

  const [totalUsers, totalListings, bookingsToday, revenueTodayAgg] = await Promise.all([
    User.countDocuments(),
    Listing.countDocuments(),
    Booking.countDocuments({ createdAt: { $gte: today } }),
    Payment.aggregate([
      {
        $match: {
          status: "paid",
          createdAt: { $gte: today },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  const revenueTodayPaise = revenueTodayAgg[0]?.total || 0;

  return {
    activeUsers: activeSocketCount,
    totalUsers,
    totalListings,
    bookingsToday,
    revenueTodayRupees: Math.round(revenueTodayPaise / 100),
    updatedAt: new Date().toISOString(),
  };
};

module.exports.emitAdminAnalytics = async (io) => {
  if (!io) return;
  try {
    const stats = await module.exports.getLiveStats();
    io.to("admin:analytics").emit("admin:analytics:update", stats);
  } catch (err) {
    console.warn("Failed to emit admin analytics:", err.message);
  }
};
