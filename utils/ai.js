const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports.generateItinerary = async (listingTitle, listingLocation) => {
    // Check for API Key - if missing, use fallback
    if (!process.env.GOOGLE_API_KEY) {
        console.log("⚠️ Google API Key missing - using fallback itinerary");
        return generateFallbackItinerary(listingTitle, listingLocation);
    }

    try {
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
        const text = response.text();
        return text;
    } catch (err) {
        console.error("❌ Gemini AI Error:", err);
        // Fallback to simple itinerary if API fails
        return generateFallbackItinerary(listingTitle, listingLocation);
    }
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
