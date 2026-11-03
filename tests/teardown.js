module.exports = async () => {
  try {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  } catch (_) {
    // ignore
  }

  try {
    const { createClient } = require("redis");
    // Best-effort: close if app initialized redis during tests
  } catch (_) {
    // ignore
  }
};
