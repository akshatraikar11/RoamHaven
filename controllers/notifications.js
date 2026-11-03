const Notification = require("../models/notification");

module.exports.list = async (req, res) => {
  const limit = Math.min(25, Math.max(1, Number(req.query.limit || 10)));
  const items = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const unreadCount = await Notification.countDocuments({
    user: req.user._id,
    isRead: false,
  });

  res.json({ success: true, items, unreadCount });
};

module.exports.markRead = async (req, res) => {
  const { id } = req.params;
  await Notification.updateOne(
    { _id: id, user: req.user._id },
    { $set: { isRead: true } }
  );
  res.json({ success: true });
};

module.exports.readAll = async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { $set: { isRead: true } }
  );
  res.json({ success: true });
};

