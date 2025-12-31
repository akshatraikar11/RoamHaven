const axios = require('axios');
require('dotenv').config();

async function listModels() {
    const key = process.env.GOOGLE_API_KEY;
    if (!key) {
        console.log("No API Key found");
        return;
    }

    try {
        console.log("Requesting available models via REST API...");
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);

        console.log("✅ Models found:");
        const models = response.data.models;
        models.forEach(m => {
            if (m.supportedGenerationMethods.includes("generateContent")) {
                console.log(`- ${m.name}`); // format: models/model-name
            }
        });
    } catch (error) {
        console.error("❌ API Request Failed:", error.response ? error.response.data : error.message);
    }
}

listModels();
