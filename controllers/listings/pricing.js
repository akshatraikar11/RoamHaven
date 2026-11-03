/**
 * Dynamic pricing utilities for listings
 */

// ==========================================
// Amenities metadata (icon + label mapping)
// ==========================================
const AMENITIES_MAP = {
  wifi: { icon: "fa-solid fa-wifi", label: "WiFi" },
  ac: { icon: "fa-solid fa-snowflake", label: "Air Conditioning" },
  kitchen: { icon: "fa-solid fa-kitchen-set", label: "Kitchen" },
  parking: { icon: "fa-solid fa-square-parking", label: "Free Parking" },
  pool: { icon: "fa-solid fa-person-swimming", label: "Pool" },
  tv: { icon: "fa-solid fa-tv", label: "TV" },
  washer: { icon: "fa-solid fa-shirt", label: "Washer" },
  dryer: { icon: "fa-solid fa-wind", label: "Dryer" },
  heating: { icon: "fa-solid fa-temperature-arrow-up", label: "Heating" },
  gym: { icon: "fa-solid fa-dumbbell", label: "Gym" },
  elevator: { icon: "fa-solid fa-elevator", label: "Elevator" },
  balcony: { icon: "fa-solid fa-person-shelter", label: "Balcony" },
  garden: { icon: "fa-solid fa-tree", label: "Garden" },
  bbq: { icon: "fa-solid fa-fire-burner", label: "BBQ Grill" },
  hot_tub: { icon: "fa-solid fa-hot-tub-person", label: "Hot Tub" },
  fireplace: { icon: "fa-solid fa-fire", label: "Fireplace" },
  workspace: { icon: "fa-solid fa-laptop", label: "Dedicated Workspace" },
  pet_friendly: { icon: "fa-solid fa-paw", label: "Pet Friendly" },
  security_camera: { icon: "fa-solid fa-video", label: "Security Camera" },
  smoke_alarm: { icon: "fa-solid fa-bell", label: "Smoke Alarm" },
};

// ==========================================
// Feature #17: Dynamic Pricing Calculator
// ==========================================
function calculateDynamicPrice(listing, checkInDate, checkOutDate) {
  const basePrice = listing.price;
  const weekendPrice = listing.weekendPrice || basePrice;
  const seasonalPricing = listing.seasonalPricing || [];

  if (!checkInDate || !checkOutDate) return { nightlyPrice: basePrice, totalPrice: basePrice, nights: 1, breakdown: [] };

  const start = new Date(checkInDate);
  const end = new Date(checkOutDate);
  const nights = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

  let totalPrice = 0;
  const breakdown = [];

  const demandMultiplier = Number(listing?.surgeMultiplier || 1);
  const shouldApplyDemand = demandMultiplier > 1;

  for (let i = 0; i < nights; i++) {
    const currentDate = new Date(start);
    currentDate.setDate(currentDate.getDate() + i);
    const dayOfWeek = currentDate.getDay(); // 0=Sun, 5=Fri, 6=Sat

    // Check seasonal pricing first
    let nightPrice = basePrice;
    let priceType = "base";

    for (const season of seasonalPricing) {
      const sStart = new Date(season.startDate);
      const sEnd = new Date(season.endDate);
      if (currentDate >= sStart && currentDate <= sEnd) {
        nightPrice = season.price;
        priceType = season.name || "seasonal";
        break;
      }
    }

    // Weekend override (Fri=5, Sat=6) — only if no seasonal pricing applied
    if (priceType === "base" && (dayOfWeek === 5 || dayOfWeek === 6) && weekendPrice !== basePrice) {
      nightPrice = weekendPrice;
      priceType = "weekend";
    }

    // Feature #135: Dynamic surge pricing
    if (shouldApplyDemand) {
      nightPrice = Math.round(nightPrice * demandMultiplier);
      if (priceType === "base") priceType = "surge";
      else priceType = `${priceType}+surge`;
    }

    totalPrice += nightPrice;
    breakdown.push({
      date: currentDate.toISOString().split("T")[0],
      price: nightPrice,
      type: priceType,
    });
  }

  const avgNightlyPrice = Math.round(totalPrice / nights);

  return { nightlyPrice: avgNightlyPrice, totalPrice, nights, breakdown };
}

module.exports = {
  AMENITIES_MAP,
  calculateDynamicPrice,
};
