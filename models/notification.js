const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, required: true }, // e.g. booking_confirmed, booking_request, refund_processed
  title: { type: String, default: "" },
  message: { type: String, default: "" },
  link: { type: String, default: "" },
  isRead: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);

