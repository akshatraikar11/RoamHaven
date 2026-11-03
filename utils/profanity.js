// Profanity / Inappropriate Content Filter Wordlist and Utility

const profaneWords = [
  "fuck", "shit", "bitch", "asshole", "cunt", "dick", "bastard", "piss", "crap",
  "scam", "fraud", "fake", "spam", "garbage", "trash", "suck", "sucks", "idiot",
  "stupid", "moron", "dumb", "hate", "kill", "die", "nigger", "faggot", "retard"
];

/**
 * Automatically censors profane/inappropriate words in a string.
 * Keeps the first and last letters of the word, replacing the inside with asterisks.
 * Example: "This place is shit and a scam!" -> "This place is s**t and a s**m!"
 * @param {string} text 
 * @returns {string} Cleaned text
 */
module.exports.censorProfanity = (text) => {
  if (!text || typeof text !== "string") return text;
  
  let cleanedText = text;
  
  for (const word of profaneWords) {
    // Match word boundary-insensitive or word boundary-sensitive matches to be robust
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    cleanedText = cleanedText.replace(regex, (match) => {
      if (match.length <= 2) {
        return "*".repeat(match.length);
      }
      const firstChar = match.charAt(0);
      const lastChar = match.charAt(match.length - 1);
      const asterisks = "*".repeat(match.length - 2);
      return `${firstChar}${asterisks}${lastChar}`;
    });
  }
  
  return cleanedText;
};
