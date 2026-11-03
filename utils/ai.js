const { GoogleGenerativeAI } = require("@google/generative-ai");
const { geminiCircuitBreaker } = require("./circuitBreaker");

module.exports.generateItinerary = async (listingTitle, listingLocation) => {
    // Check for API Key - if missing, use fallback
    if (!process.env.GOOGLE_API_KEY) {
        console.log("⚠️ Google API Key missing - using fallback itinerary");
        return generateFallbackItinerary(listingTitle, listingLocation);
    }

    // System Design: Circuit Breaker protection around Gemini AI service
    return await geminiCircuitBreaker.execute(
        async () => {
            console.log(`🤖 Requesting Itinerary for: ${listingTitle} in ${listingLocation}`);
            const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const prompt = `
          Act as a professional travel agent. create a 3-day itinerary for a trip to "${listingLocation}" (Listing: "${listingTitle}").
          
          Format the response in clean Markdown.
          Structure it as:
          ## 📅 3-Day Trip to ${listingLocation}
          
          ### Day 1: [Theme of the Day]
          - **Morning**: ...
          - **Afternoon**: ...
          - **Evening**: ...
          
          ... (Repeat for Day 2 and 3)
          
          ### 🎒 Packing Tips
          - ...
          
          Keep it engaging and specific to the location.
        `;

            console.log(`🤖 Generating itinerary for ${listingLocation}...`);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        },
        async (err) => {
            console.warn("⚠️ Circuit Breaker fallback activated for Itinerary generation:", err.message);
            return generateFallbackItinerary(listingTitle, listingLocation);
        }
    );
};

// Simple fallback itinerary generator
function generateFallbackItinerary(listingTitle, listingLocation) {
    return `## 📅 3-Day Trip to ${listingLocation}

### Day 1: Arrival & Local Exploration
- **Morning**: Check into **${listingTitle}** and settle in
- **Afternoon**: Explore the local neighborhood and nearby attractions
- **Evening**: Enjoy local cuisine at a recommended restaurant

### Day 2: Main Attractions
- **Morning**: Visit the top tourist spots in ${listingLocation}
- **Afternoon**: Lunch at a local favorite, then continue sightseeing
- **Evening**: Relax at your accommodation or explore nightlife

### Day 3: Culture & Departure
- **Morning**: Visit local markets and cultural sites
- **Afternoon**: Last-minute shopping and lunch
- **Evening**: Prepare for departure

### 🎒 Packing Tips
- Comfortable walking shoes
- Weather-appropriate clothing
- Camera for memories
- Local currency
- Travel documents

**Note**: This is a basic itinerary. For a personalized AI-generated plan, contact our support team!`;
}

module.exports.chatWithContext = async (userMessage, contextData) => {
    if (!process.env.GOOGLE_API_KEY) {
        throw new Error("API Key Missing");
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const systemInstruction = `
        You are RoamMate, the official AI assistant for the RoamHaven travel website. 
        Your goal is to help users find the perfect stay from OUR available listings.

        STRICT RULES:
        1. **Only use the provided Context Data**. Do not invent listings.
        2. If the user asks for a location not in the context, say: "I'm sorry, I couldn't find any listings in [Location] on RoamHaven right now."
        3. Be friendly, concise, and professional.
        4. When suggesting a listing, mention its Name, Location, and Price.
        
        CONTEXT DATA (Available Listings):
        ${contextData}
        `;

        const prompt = `${systemInstruction}\n\nUser Question: ${userMessage}\nAnswer:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (err) {
        console.error("❌ Gemini Chat Error:", err);
        return "I'm having trouble accessing the database right now.";
    }
};

module.exports.generateReviewSummary = async (listingTitle, reviews) => {
    if (!process.env.GOOGLE_API_KEY || !reviews || reviews.length === 0) {
        console.log("⚠️ Google API Key missing or no reviews - using fallback review summary");
        return generateFallbackReviewSummary(listingTitle, reviews);
    }

    try {
        console.log(`🤖 Requesting AI Review Summary for: ${listingTitle}`);
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const reviewsText = reviews.map((r, i) => `Review ${i+1} (${r.rating} stars): "${r.comment}"`).join("\n");

        const prompt = `
        You are a helpful travel assistant. Summarize the following reviews for the listing "${listingTitle}" in one engaging, objective, and constructive paragraph. 
        Focus on what guests loved (e.g. communication, location, value) and mention any minor complaints if relevant.
        Make sure the response is a single paragraph of 3-5 sentences. Do not use bullet points.

        REVIEWS:
        ${reviewsText}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (err) {
        console.error("❌ Gemini AI Review Summary Error:", err);
        return generateFallbackReviewSummary(listingTitle, reviews);
    }
};

function generateFallbackReviewSummary(listingTitle, reviews) {
    if (!reviews || reviews.length === 0) {
        return "No reviews have been left for this property yet, so an AI summary cannot be generated.";
    }
    
    // Construct a smart fallback summary
    const count = reviews.length;
    const avg = (reviews.reduce((acc, r) => acc + r.rating, 0) / count).toFixed(1);
    
    let tone = "excellent";
    if (avg < 3.5) tone = "mixed";
    else if (avg < 4.5) tone = "very positive";
    
    return `Based on ${count} guest review(s), this stay has received ${tone} feedback with an average rating of ${avg} stars. Guests commonly highlight the property's clean presentation and convenient location. Overall, it stands out as a highly recommended stay in the area.`;
}

const VALID_CATEGORIES = [
    "trending", "rooms", "iconic_cities", "mountains", "castles",
    "pools", "camping", "farms", "arctic", "pg_hostel",
];

const VALID_AMENITIES = [
    "wifi", "ac", "kitchen", "parking", "pool", "tv", "washer", "dryer",
    "heating", "gym", "elevator", "balcony", "garden", "bbq", "hot_tub",
    "fireplace", "workspace", "pet_friendly", "security_camera", "smoke_alarm",
];

function parseJsonFromModelText(text) {
    if (!text) return null;
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const raw = fenced ? fenced[1].trim() : text.trim();
    try {
        return JSON.parse(raw);
    } catch (_) {
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(raw.slice(start, end + 1));
            } catch (__) {
                return null;
            }
        }
        return null;
    }
}

function normalizeSearchIntent(parsed, fallbackQuery) {
    const out = {
        location: null,
        minPrice: null,
        maxPrice: null,
        category: null,
        amenities: [],
        maxGuests: null,
        keywords: fallbackQuery,
    };
    if (!parsed || typeof parsed !== "object") return out;

    if (parsed.location) out.location = String(parsed.location).trim();
    if (parsed.minPrice != null && !Number.isNaN(Number(parsed.minPrice))) {
        out.minPrice = Number(parsed.minPrice);
    }
    if (parsed.maxPrice != null && !Number.isNaN(Number(parsed.maxPrice))) {
        out.maxPrice = Number(parsed.maxPrice);
    }
    if (parsed.maxGuests != null && !Number.isNaN(Number(parsed.maxGuests))) {
        out.maxGuests = Number(parsed.maxGuests);
    }
    if (parsed.category && VALID_CATEGORIES.includes(parsed.category)) {
        out.category = parsed.category;
    }
    if (Array.isArray(parsed.amenities)) {
        out.amenities = parsed.amenities
            .map((a) => String(a).toLowerCase().trim())
            .filter((a) => VALID_AMENITIES.includes(a));
    }
    if (parsed.keywords) out.keywords = String(parsed.keywords).trim();
    return out;
}

function fallbackParseNaturalLanguageSearch(query) {
    const q = query.toLowerCase();
    const parsed = normalizeSearchIntent({}, query);

    const underMatch =
        q.match(/under\s*₹?\s*(\d[\d,]*)/i) ||
        q.match(/below\s*₹?\s*(\d[\d,]*)/i) ||
        q.match(/less than\s*₹?\s*(\d[\d,]*)/i);
    if (underMatch) parsed.maxPrice = Number(underMatch[1].replace(/,/g, ""));

    const overMatch =
        q.match(/above\s*₹?\s*(\d[\d,]*)/i) ||
        q.match(/over\s*₹?\s*(\d[\d,]*)/i);
    if (overMatch) parsed.minPrice = Number(overMatch[1].replace(/,/g, ""));

    const guestMatch = q.match(/(\d+)\s*(guests?|people)/i);
    if (guestMatch) parsed.maxGuests = Number(guestMatch[1]);

    const categoryHints = {
        mountains: "mountains",
        mountain: "mountains",
        beach: "pools",
        pool: "pools",
        camping: "camping",
        farm: "farms",
        castle: "castles",
        city: "iconic_cities",
        hostel: "pg_hostel",
        room: "rooms",
    };
    for (const [hint, category] of Object.entries(categoryHints)) {
        if (q.includes(hint)) {
            parsed.category = category;
            break;
        }
    }

    for (const amenity of VALID_AMENITIES) {
        if (q.includes(amenity.replace("_", " ")) || q.includes(amenity)) {
            parsed.amenities.push(amenity);
        }
    }

    const inMatch = q.match(/\bin\s+([a-z][a-z\s-]{1,40})/i);
    if (inMatch) {
        parsed.location = inMatch[1].trim().replace(/\s+(with|under|for|near).*$/i, "").trim();
    } else {
        const cities = [
            "nashik", "mumbai", "goa", "delhi", "bangalore", "pune",
            "manali", "jaipur", "kerala", "shimla", "udaipur",
        ];
        for (const city of cities) {
            if (q.includes(city)) {
                parsed.location = city;
                break;
            }
        }
    }

    return parsed;
}

// Feature #71: AI natural language search → MongoDB filter intent
module.exports.parseNaturalLanguageSearch = async (query) => {
    const trimmed = String(query || "").trim();
    if (!trimmed) return fallbackParseNaturalLanguageSearch("");

    if (!process.env.GOOGLE_API_KEY) {
        return fallbackParseNaturalLanguageSearch(trimmed);
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
Parse this vacation rental search query into JSON only.
Keys:
- location (string|null)
- minPrice (number|null, INR per night)
- maxPrice (number|null, INR per night)
- category (one of ${VALID_CATEGORIES.join(", ")} or null)
- amenities (array subset of ${VALID_AMENITIES.join(", ")})
- maxGuests (number|null)
- keywords (short text fallback)

Query: "${trimmed}"
Return ONLY valid JSON.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = parseJsonFromModelText(text);
        return normalizeSearchIntent(parsed, trimmed);
    } catch (err) {
        console.error("❌ Gemini NL search parse error:", err.message);
        return fallbackParseNaturalLanguageSearch(trimmed);
    }
};

module.exports.buildListingsSearchUrl = (intent) => {
    const params = new URLSearchParams();
    if (intent.location) params.set("location", intent.location);
    if (intent.minPrice != null) params.set("minPrice", String(intent.minPrice));
    if (intent.maxPrice != null) params.set("maxPrice", String(intent.maxPrice));
    if (intent.category) params.set("category", intent.category);
    if (intent.maxGuests != null) params.set("maxGuests", String(intent.maxGuests));
    if (intent.amenities?.length) params.set("amenities", intent.amenities.join(","));
    if (intent.keywords) params.set("q", intent.keywords);
    const qs = params.toString();
    return qs ? `/listings?${qs}` : "/listings";
};

// Feature #73: AI listing description generator
module.exports.generateListingDescription = async ({
    title,
    location,
    country,
    category,
    price,
    amenities = [],
    bedrooms,
    bathrooms,
    maxGuests,
}) => {
    const details = {
        title: title || "Untitled stay",
        location: location || "Unknown",
        country: country || "India",
        category: category || "rooms",
        price: price || 0,
        amenities,
        bedrooms,
        bathrooms,
        maxGuests,
    };

    if (!process.env.GOOGLE_API_KEY) {
        return generateFallbackListingDescription(details);
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
Write a compelling Airbnb-style listing description (2 short paragraphs, warm and professional).
Do not use markdown headings or bullet lists.

Listing details:
${JSON.stringify(details, null, 2)}
`;
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (err) {
        console.error("❌ Gemini description error:", err.message);
        return generateFallbackListingDescription(details);
    }
};

function generateFallbackListingDescription(details) {
    const amenityText = details.amenities?.length
        ? ` Highlights include ${details.amenities.slice(0, 4).join(", ")}.`
        : "";
    return `Welcome to ${details.title}, a thoughtfully hosted stay in ${details.location}, ${details.country}. This ${details.category.replace(/_/g, " ")} property is ideal for travelers seeking comfort, convenience, and great value at around ₹${details.price}/night.${amenityText}\n\nEnjoy a relaxing experience with space for up to ${details.maxGuests || 2} guests, ${details.bedrooms || 1} bedroom(s), and ${details.bathrooms || 1} bathroom(s). Book now on RoamHaven for a memorable trip.`;
}

function parseWeekendDates(nights = 2) {
    const start = new Date();
    const day = start.getDay();
    const daysUntilFriday = (5 - day + 7) % 7 || 7;
    start.setDate(start.getDate() + daysUntilFriday);
    const end = new Date(start);
    end.setDate(end.getDate() + Math.max(1, nights));
    return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
    };
}

function fallbackBookingIntent(message) {
    const q = message.toLowerCase();
    const intent = {
        action: "chat",
        location: null,
        nights: 2,
        maxPrice: null,
        listingTitle: null,
        reply: null,
    };

    const bookMatch = q.match(/book(?:\s+me)?\s+(?:in|at|near)?\s*([a-z\s-]{2,40})/i);
    const nightsMatch = q.match(/(\d+)\s*nights?/i);
    if (nightsMatch) intent.nights = Number(nightsMatch[1]);

    if (bookMatch) intent.location = bookMatch[1].trim();
    if (q.includes("weekend") && !nightsMatch) intent.nights = 2;

    const underMatch = q.match(/under\s*₹?\s*(\d[\d,]*)/i);
    if (underMatch) intent.maxPrice = Number(underMatch[1].replace(/,/g, ""));

    if (/(book|reserve|booking)/i.test(q)) intent.action = "book";
    return intent;
}

// Feature #78: Conversational booking via RoamMate
module.exports.processRoamMateMessage = async ({
    message,
    listingsContext = "",
    isLoggedIn = false,
    history = [],
}) => {
    const trimmed = String(message || "").trim();
    if (!trimmed) {
        return { reply: "Please type a message so I can help you.", action: "chat" };
    }

    if (!process.env.GOOGLE_API_KEY) {
        return processRoamMateFallback({ message: trimmed, isLoggedIn });
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const historyText = history
            .slice(-6)
            .map((h) => `${h.role}: ${h.content}`)
            .join("\n");

        const prompt = `
You are RoamMate, RoamHaven's booking assistant.
Return ONLY JSON with keys:
- action: "chat" | "search" | "book"
- reply: HTML string (use <b>, <br>, <a href='...'> sparingly)
- location: string|null
- nights: number (default 2)
- maxPrice: number|null (INR)
- listingTitle: string|null (must match a listing title from context when booking)
- searchQuery: string|null (for action "search")

Rules:
1) Use ONLY listings from CONTEXT DATA for booking suggestions.
2) For booking requests, set action "book" and pick the best matching listing title.
3) If user isn't specific, ask a clarifying question with action "chat".
4) Mention login requirement in reply when action is "book" and user is not logged in.

User logged in: ${isLoggedIn}
Conversation:
${historyText}

CONTEXT DATA:
${listingsContext}

User: ${trimmed}
`;

        const result = await model.generateContent(prompt);
        const parsed = parseJsonFromModelText(result.response.text());
        if (!parsed?.reply) {
            return processRoamMateFallback({ message: trimmed, isLoggedIn });
        }

        return {
            action: parsed.action || "chat",
            reply: parsed.reply,
            location: parsed.location || null,
            nights: Number(parsed.nights) || 2,
            maxPrice: parsed.maxPrice != null ? Number(parsed.maxPrice) : null,
            listingTitle: parsed.listingTitle || null,
            searchQuery: parsed.searchQuery || null,
        };
    } catch (err) {
        console.error("❌ RoamMate AI error:", err.message);
        return processRoamMateFallback({ message: trimmed, isLoggedIn });
    }
};

async function processRoamMateFallback({ message, isLoggedIn }) {
    const intent = fallbackBookingIntent(message);

    if (intent.action === "book" && intent.location) {
        const filter = { location: new RegExp(intent.location, "i") };
        if (intent.maxPrice) filter.price = { $lte: intent.maxPrice };
        const Listing = require("../models/listing");
        const listing = await Listing.findOne(filter).sort({ price: 1 }).select("title _id location price");
        if (!listing) {
            return {
                action: "search",
                reply: `I couldn't find a stay in <b>${intent.location}</b> right now. Try our <a href='/listings?location=${encodeURIComponent(intent.location)}'>search results</a>.`,
                searchQuery: intent.location,
            };
        }

        const dates = parseWeekendDates(intent.nights);
        const bookUrl = `/bookings/${listing._id}/book?startDate=${dates.startDate}&endDate=${dates.endDate}`;
        const loginNote = isLoggedIn
            ? `<a href='${bookUrl}' class='btn btn-sm btn-primary mt-2'>Continue booking</a>`
            : `<a href='/login'>Log in</a> to complete your booking.`;

        return {
            action: "book",
            reply:
                `Great choice! I found <b>${listing.title}</b> in ${listing.location} at ₹${listing.price}/night.<br>` +
                `Suggested dates: ${dates.startDate} → ${dates.endDate}.<br>${loginNote}`,
            bookingLink: isLoggedIn ? bookUrl : "/login",
            listingId: String(listing._id),
        };
    }

    return {
        action: "chat",
        reply:
            "I can help you book a stay. Try: <i>Book me in Nashik for 2 nights this weekend under ₹3000</i>.",
    };
}
