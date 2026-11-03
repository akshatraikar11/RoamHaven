const { censorProfanity } = require("../../utils/profanity");

describe("profanity filter", () => {
  test("censors known profane words while keeping shape", () => {
    const result = censorProfanity("This place is shit and a scam!");
    expect(result).toContain("s**t");
    expect(result).toContain("s**m");
    expect(result).not.toMatch(/\bshit\b/i);
  });

  test("returns empty-ish input unchanged", () => {
    expect(censorProfanity("")).toBe("");
    expect(censorProfanity(null)).toBe(null);
  });
});
