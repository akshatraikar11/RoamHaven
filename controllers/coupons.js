const Coupon = require("../models/coupon");

module.exports.listCoupons = async (req, res) => {
  const coupons = await Coupon.find({}).sort({ createdAt: -1 });
  res.render("admin/coupons", { coupons });
};

module.exports.createCoupon = async (req, res) => {
  const {
    code,
    discountType,
    discountValue,
    maxDiscount,
    minBookingAmount,
    expiresAt,
    usageLimit,
    isActive,
  } = req.body || {};

  if (!code) {
    req.flash("error", "Coupon code is required.");
    return res.redirect("/admin/coupons");
  }

  if (!discountType || !["percentage", "flat"].includes(discountType)) {
    req.flash("error", "Invalid discount type.");
    return res.redirect("/admin/coupons");
  }

  const expires = expiresAt ? new Date(expiresAt) : null;
  if (!expires || Number.isNaN(expires.getTime())) {
    req.flash("error", "Valid expiry date is required.");
    return res.redirect("/admin/coupons");
  }

  const newCoupon = await Coupon.create({
    code,
    discountType,
    discountValue: Number(discountValue),
    maxDiscount: maxDiscount === "" || maxDiscount === undefined ? null : Number(maxDiscount),
    minBookingAmount: Number(minBookingAmount || 0),
    expiresAt: expires,
    usageLimit: Number(usageLimit),
    usedCount: 0,
    isActive: isActive === "false" ? false : true,
    createdBy: req.user._id,
  });

  req.flash("success", `Coupon ${newCoupon.code} created.`);
  return res.redirect("/admin/coupons");
};

module.exports.toggleCoupon = async (req, res) => {
  const { id } = req.params;
  const coupon = await Coupon.findById(id);
  if (!coupon) {
    req.flash("error", "Coupon not found.");
    return res.redirect("/admin/coupons");
  }

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  req.flash("success", `Coupon ${coupon.code} is now ${coupon.isActive ? "active" : "inactive"}.`);
  return res.redirect("/admin/coupons");
};

module.exports.deleteCoupon = async (req, res) => {
  const { id } = req.params;
  const coupon = await Coupon.findByIdAndDelete(id);

  if (!coupon) req.flash("error", "Coupon not found.");
  else req.flash("success", `Coupon ${coupon.code} deleted.`);

  return res.redirect("/admin/coupons");
};

