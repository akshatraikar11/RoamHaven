const Wallet = require("../models/wallet");
const User = require("../models/user");

async function getOrCreateWallet(userId) {
  let wallet = await Wallet.findOne({ user: userId });
  if (wallet) return wallet;

  wallet = await Wallet.create({ user: userId, balance: 0, transactions: [] });
  await User.findByIdAndUpdate(userId, { $set: { wallet: wallet._id } });
  return wallet;
}

module.exports.viewWallet = async (req, res) => {
  const wallet = await getOrCreateWallet(req.user._id);
  const transactions = [...(wallet.transactions || [])].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.render("wallet/index", { wallet: { ...wallet.toObject(), transactions } });
};

module.exports.getBalance = async (req, res) => {
  const wallet = await getOrCreateWallet(req.user._id);
  res.json({ success: true, balance: wallet.balance });
};

