const Listing = require("../models/listing");
const Payment = require("../models/payment");

function monthLabel(d) {
  return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

module.exports.dashboard = async (req, res) => {
  // Host-only middleware ensures role, but keep it safe for admin too.
  const listings = await Listing.find({ owner: req.user._id }).select("_id");
  const listingIds = listings.map((l) => l._id);

  if (listingIds.length === 0) {
    return res.render("revenue/dashboard", {
      monthLabels: [],
      monthlyEarningsRupees: [],
      payoutHistory: [],
      totalsRupees: 0,
    });
  }

  // Last 6 months (including current month)
  const now = new Date();
  const monthStarts = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthStarts.push(d);
  }
  const minDate = monthStarts[0];

  const monthly = await Payment.aggregate([
    {
      $match: {
        listing: { $in: listingIds },
        status: "paid",
        createdAt: { $gte: minDate },
      },
    },
    {
      $project: {
        monthKey: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        hostPayout: 1,
      },
    },
    {
      $group: {
        _id: "$monthKey",
        totalHostPayout: { $sum: "$hostPayout" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const monthKeyToTotal = {};
  for (const row of monthly) {
    monthKeyToTotal[row._id] = row.totalHostPayout || 0;
  }

  const monthLabels = monthStarts.map((d) => monthLabel(d));
  const monthlyEarningsRupees = monthStarts.map((d) => {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const amountPaise = monthKeyToTotal[key] || 0;
    return Math.round(amountPaise / 100);
  });

  const totalsRupees = monthlyEarningsRupees.reduce((a, b) => a + b, 0);

  const payoutHistory = await Payment.find({
    listing: { $in: listingIds },
    status: "paid",
  })
    .populate("listing", "title image")
    .sort({ createdAt: -1 })
    .limit(20);

  res.render("revenue/dashboard", {
    monthLabels,
    monthlyEarningsRupees,
    payoutHistory,
    totalsRupees,
  });
};

