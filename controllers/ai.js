const {
  parseNaturalLanguageSearch,
  buildListingsSearchUrl,
  generateListingDescription,
} = require("../utils/ai");

module.exports.naturalLanguageSearch = async (req, res) => {
  const { query } = req.body || {};
  if (!query || !String(query).trim()) {
    return res.status(400).json({ success: false, error: "Query is required." });
  }

  const intent = await parseNaturalLanguageSearch(String(query).trim());
  const redirectUrl = buildListingsSearchUrl(intent);

  return res.json({ success: true, intent, redirectUrl });
};

module.exports.generateDescription = async (req, res) => {
  const {
    title,
    location,
    country,
    category,
    price,
    amenities,
    bedrooms,
    bathrooms,
    maxGuests,
  } = req.body || {};

  if (!title && !location) {
    return res.status(400).json({
      success: false,
      error: "Provide at least a title or location.",
    });
  }

  const description = await generateListingDescription({
    title,
    location,
    country,
    category,
    price: Number(price) || 0,
    amenities: Array.isArray(amenities)
      ? amenities
      : String(amenities || "")
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
    bedrooms: Number(bedrooms) || 1,
    bathrooms: Number(bathrooms) || 1,
    maxGuests: Number(maxGuests) || 2,
  });

  return res.json({ success: true, description });
};
