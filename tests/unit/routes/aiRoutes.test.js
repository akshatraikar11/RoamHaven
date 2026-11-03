const aiRouter = require("../../../routes/ai.js");
const { isLoggedIn } = require("../../../middleware.js");

const getPostRouteLayers = (path) => {
  const layer = aiRouter.stack.find(
    (entry) => entry.route?.path === path && entry.route?.methods?.post
  );
  return layer?.route?.stack ?? [];
};

describe("AI route authentication wiring", () => {
  test("POST /ai/search remains publicly accessible", () => {
    const searchLayers = getPostRouteLayers("/ai/search");

    expect(searchLayers).toHaveLength(1);
    expect(searchLayers.some((layer) => layer.handle === isLoggedIn)).toBe(false);
  });

  test("POST /ai/generate-description remains protected", () => {
    const generateLayers = getPostRouteLayers("/ai/generate-description");

    expect(generateLayers).toHaveLength(2);
    expect(generateLayers[0].handle).toBe(isLoggedIn);
  });
});
