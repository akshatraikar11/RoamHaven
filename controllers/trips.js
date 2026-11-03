const TripPlan = require("../models/tripPlan");
const Listing = require("../models/listing");

// FUNCTIONAL BUG FIX: this feature is marketed as "collaborative" trip
// planning and stores invitedEmails on creation, but every query below
// previously matched `owner: req.user._id` only — invited collaborators
// could never view, vote on, or add listings to a trip they were invited
// to. This helper builds the access filter (owner OR invited-by-email) used
// consistently across index/show/addListing/vote.
function accessFilter(user) {
  const email = (user.email || "").toLowerCase();
  return { $or: [{ owner: user._id }, { invitedEmails: email }] };
}

module.exports.index = async (req, res) => {
  const trips = await TripPlan.find(accessFilter(req.user))
    .populate("listings", "title location price image")
    .sort({ createdAt: -1 });
  res.render("trips/index.ejs", { trips });
};

module.exports.create = async (req, res) => {
  const { name, destination, startDate, endDate, invitedEmails } = req.body;
  const inviteList = String(invitedEmails || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  await TripPlan.create({
    owner: req.user._id,
    name,
    destination,
    startDate,
    endDate,
    invitedEmails: inviteList,
  });
  req.flash("success", "Collaborative trip created.");
  res.redirect("/trips");
};

module.exports.show = async (req, res) => {
  const trip = await TripPlan.findOne({ _id: req.params.id, ...accessFilter(req.user) })
    .populate("listings", "title location price image maxGuests")
    .populate("votes.voter", "username");
  if (!trip) {
    req.flash("error", "Trip not found.");
    return res.redirect("/trips");
  }
  const suggestedListings = await Listing.find({})
    .select("title location price image")
    .sort({ createdAt: -1 })
    .limit(10);
  res.render("trips/show.ejs", { trip, suggestedListings });
};

module.exports.addListing = async (req, res) => {
  const { id } = req.params;
  const { listingId } = req.body;
  const trip = await TripPlan.findOneAndUpdate(
    { _id: id, ...accessFilter(req.user) },
    { $addToSet: { listings: listingId } }
  );
  if (!trip) {
    req.flash("error", "Trip not found.");
    return res.redirect("/trips");
  }
  req.flash("success", "Listing added to trip.");
  res.redirect(`/trips/${id}`);
};

module.exports.vote = async (req, res) => {
  const { id } = req.params;
  const { listingId, vote } = req.body;
  const trip = await TripPlan.findOne({ _id: id, ...accessFilter(req.user) });
  if (!trip) {
    req.flash("error", "Trip not found.");
    return res.redirect("/trips");
  }

  trip.votes = (trip.votes || []).filter(
    (v) => !(String(v.listing) === String(listingId) && String(v.voter) === String(req.user._id))
  );
  trip.votes.push({ listing: listingId, voter: req.user._id, vote: vote === "down" ? "down" : "up" });
  await trip.save();
  req.flash("success", "Vote saved.");
  res.redirect(`/trips/${id}`);
};
