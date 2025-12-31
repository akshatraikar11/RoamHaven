const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function testModel(modelName) {
    try {
        console.log(`Testing model: ${modelName}...`);
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello, are you working?");
        console.log(`✅ SUCCESS: ${modelName} is working!`);
        return true;
    } catch (err) {
        console.log(`❌ FAILURE: ${modelName} failed. Error: ${err.message}`);
        return false;
    }
}

async function main() {
    const candidates = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-001",
        "gemini-1.0-pro",
        "gemini-pro"
    ];

    for (const name of candidates) {
        try {
            console.log(`Trying: ${name}`);
            const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
            const model = genAI.getGenerativeModel({ model: name });
            await model.generateContent("Test");
            console.log(`!!! SUCCESS: ${name} !!!`);
            break;
        } catch (e) {
            console.log(`Failed: ${name}`);
        }
    }
}

main();
