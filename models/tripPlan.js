const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const tripVoteSchema = new Schema(
  {
    listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    voter: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vote: { type: String, enum: ["up", "down"], default: "up" },
  },
  { _id: false }
);

const tripPlanSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    destination: String,
    startDate: Date,
    endDate: Date,
    invitedEmails: [String],
    listings: [{ type: Schema.Types.ObjectId, ref: "Listing" }],
    votes: [tripVoteSchema],
  },
  { timestamps: true }
);

tripPlanSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model("TripPlan", tripPlanSchema);
