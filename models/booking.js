const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
  listing: { type: Schema.Types.ObjectId, ref: "Listing" },
  user: { type: Schema.Types.ObjectId, ref: "User" },
  name: String,
  mobile: String,
  email: String,
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  timeSlot: String,
  guests: Number,
  meal: String,
  offer: String
});

module.exports = mongoose.model("Booking", bookingSchema);
