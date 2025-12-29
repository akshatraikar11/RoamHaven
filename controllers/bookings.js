const Listing = require("../models/listing");
const Booking = require("../models/booking");

module.exports.renderBookingForm = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found");
        return res.redirect("/listings");
    }
    res.render("bookings/new", { listing });
};

module.exports.createBooking = async (req, res) => {
    const { listingId, name, mobile, email, startDate, endDate } = req.body;

    try {
        const booking = new Booking({
            listing: listingId,
            user: req.user._id,
            name,
            mobile,
            email,
            startDate,
            endDate
        });

        await booking.save();
        req.flash("success", "Booking confirmed!");
        res.redirect(`/listings/${listingId}`);
    } catch (err) {
        console.log(err);
        req.flash("error", "Something went wrong with booking.");
        res.redirect(`/listings/${listingId}`);
    }
};
