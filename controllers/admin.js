const User = require("../models/user");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Payment = require("../models/payment");
const { getLiveStats } = require("../utils/analytics");

function monthLabel(d) {
  return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

module.exports.dashboard = async (req, res) => {
  const now = new Date();
  const monthStarts = [];
  for (let i = 5; i >= 0; i--) {
    monthStarts.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  const minDate = monthStarts[0];

  const [totals, monthlyRevenue, monthlyBookings, liveStats] = await Promise.all([
    Promise.all([
      User.countDocuments(),
      Listing.countDocuments(),
      Booking.countDocuments(),
      Payment.aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]),
    Payment.aggregate([
      { $match: { status: "paid", createdAt: { $gte: minDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          revenue: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Booking.aggregate([
      { $match: { createdAt: { $gte: minDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    getLiveStats(),
  ]);

  const [totalUsers, totalListings, totalBookings, revenueAgg] = totals;
  const totalRevenueRupees = Math.round((revenueAgg[0]?.total || 0) / 100);

  const revenueMap = Object.fromEntries(
    monthlyRevenue.map((r) => [r._id, Math.round(r.revenue / 100)])
  );
  const bookingsMap = Object.fromEntries(
    monthlyBookings.map((b) => [b._id, b.count])
  );

  const monthLabels = monthStarts.map((d) => monthLabel(d));
  const monthlyRevenueRupees = monthStarts.map((d) => {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return revenueMap[key] || 0;
  });
  const monthlyBookingCounts = monthStarts.map((d) => {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return bookingsMap[key] || 0;
  });

  res.render("admin/dashboard", {
    totalUsers,
    totalListings,
    totalBookings,
    totalRevenueRupees,
    monthLabels,
    monthlyRevenueRupees,
    monthlyBookingCounts,
    liveStats,
  });
};

module.exports.liveStatsApi = async (req, res) => {
  const stats = await getLiveStats();
  res.json({ success: true, stats });
};
