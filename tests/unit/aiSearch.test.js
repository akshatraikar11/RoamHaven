const { parseNaturalLanguageSearch, buildListingsSearchUrl } = require("../../utils/ai");

describe("AI natural language search fallback", () => {
  const originalKey = process.env.GOOGLE_API_KEY;

  beforeAll(() => {
    delete process.env.GOOGLE_API_KEY;
  });

  afterAll(() => {
    if (originalKey) process.env.GOOGLE_API_KEY = originalKey;
  });

  test("parses location, max price, and pool amenity", async () => {
    const intent = await parseNaturalLanguageSearch(
      "Cozy mountain cabin under 3000 with pool in Manali"
    );

    expect(intent.maxPrice).toBe(3000);
    expect(intent.location?.toLowerCase()).toContain("manali");
    expect(intent.amenities).toContain("pool");
    expect(intent.category).toBe("mountains");
  });

  test("builds listings URL from parsed intent", () => {
    const url = buildListingsSearchUrl({
      location: "Goa",
      maxPrice: 2500,
      amenities: ["wifi", "pool"],
      keywords: "beach stay",
    });

    expect(url).toContain("location=Goa");
    expect(url).toContain("maxPrice=2500");
    expect(url).toContain("amenities=wifi%2Cpool");
    expect(url).toContain("q=beach");
  });
});
