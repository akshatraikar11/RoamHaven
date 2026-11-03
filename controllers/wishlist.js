const User = require("../models/user");
const Listing = require("../models/listing");

module.exports.index = async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: "favorites",
    select: "title image location country price reviews",
    populate: { path: "reviews", select: "rating" },
  });

  res.render("users/wishlist.ejs", { favorites: user?.favorites || [] });
};

module.exports.toggle = async (req, res) => {
  const { listingId } = req.params;
  const listing = await Listing.findById(listingId).select("_id");
  if (!listing) return res.status(404).json({ success: false, error: "Listing not found" });

  const user = await User.findById(req.user._id).select("favorites");
  const favs = new Set((user.favorites || []).map((id) => String(id)));
  const key = String(listing._id);
  let isFavorite = false;

  if (favs.has(key)) {
    await User.updateOne({ _id: req.user._id }, { $pull: { favorites: listing._id } });
    isFavorite = false;
  } else {
    await User.updateOne({ _id: req.user._id }, { $addToSet: { favorites: listing._id } });
    isFavorite = true;
  }

  res.json({ success: true, isFavorite });
};

