const Listing = require("../models/listing");
const {
  processRoamMateMessage,
  buildListingsSearchUrl,
  parseNaturalLanguageSearch,
} = require("../utils/ai");

async function buildListingsContext() {
  const listings = await Listing.find({})
    .limit(40)
    .select("title price location country category amenities maxGuests")
    .lean();

  return listings
    .map(
      (l, i) =>
        `${i + 1}. ${l.title} | ${l.location}, ${l.country} | ₹${l.price}/night | category=${l.category} | guests=${l.maxGuests || 2}`
    )
    .join("\n");
}

function findListingByTitle(listings, title) {
  if (!title) return null;
  const normalized = title.toLowerCase().trim();
  return (
    listings.find((l) => l.title.toLowerCase() === normalized) ||
    listings.find((l) => l.title.toLowerCase().includes(normalized)) ||
    listings.find((l) => normalized.includes(l.title.toLowerCase()))
  );
}

module.exports.handleChat = async (req, res) => {
  try {
    const { message, history = [] } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ reply: "Please enter a message." });
    }

    const userMessage = String(message).trim();
    const isLoggedIn = !!req.user;
    const listings = await Listing.find({})
      .limit(40)
      .select("title price location _id")
      .lean();
    const listingsContext = await buildListingsContext();

    const aiResult = await processRoamMateMessage({
      message: userMessage,
      listingsContext,
      isLoggedIn,
      history: Array.isArray(history) ? history : [],
    });

    let reply = aiResult.reply || "How can I help you today?";
    let bookingLink = aiResult.bookingLink || null;
    let redirectUrl = null;
    // Structured link data instead of embedding raw HTML in `reply` — reply is
    // partly LLM-generated text (a prompt-injection vector) and was previously
    // rendered client-side via innerHTML with no escaping. The client now
    // builds any link with safe DOM APIs (createElement + textContent).
    let link = null;

    if (aiResult.action === "search" && aiResult.searchQuery) {
      const intent = await parseNaturalLanguageSearch(aiResult.searchQuery);
      redirectUrl = buildListingsSearchUrl(intent);
      link = { url: redirectUrl, label: "View matching stays" };
    }

    if (aiResult.action === "book") {
      const listing = findListingByTitle(listings, aiResult.listingTitle);
      if (listing) {
        const nights = Number(aiResult.nights) || 2;
        const start = new Date();
        start.setDate(start.getDate() + 1);
        const end = new Date(start);
        end.setDate(end.getDate() + nights);
        const startDate = start.toISOString().split("T")[0];
        const endDate = end.toISOString().split("T")[0];
        bookingLink = `/bookings/${listing._id}/book?startDate=${startDate}&endDate=${endDate}`;
        if (isLoggedIn) {
          link = { url: bookingLink, label: "Continue booking" };
        } else {
          link = { url: "/login", label: "Log in to complete your booking" };
        }
      }
    }

    return res.json({
      reply,
      action: aiResult.action || "chat",
      bookingLink: isLoggedIn ? bookingLink : null,
      redirectUrl,
      link,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      reply:
        "😔 Sorry, I'm having trouble right now. Please try again or contact support@roamhaven.com",
    });
  }
};
