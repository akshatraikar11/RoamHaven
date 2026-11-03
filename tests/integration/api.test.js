const request = require("supertest");
const { app } = require("../../app");

describe("API integration", () => {
  test("GET /api/health returns service status payload", async () => {
    const res = await request(app).get("/api/health");

    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("db");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("timestamp");
  });

  test("POST /api/ai/search validates empty query", async () => {
    const res = await request(app)
      .post("/api/ai/search")
      .send({ query: "   " });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("POST /api/ai/search returns redirect URL for natural query", async () => {
    const res = await request(app)
      .post("/api/ai/search")
      .send({ query: "rooms in Pune under 2000" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.redirectUrl).toMatch(/^\/listings\?/);
    expect(res.body.intent).toBeDefined();
  });

  test("GET / redirects to listings index", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/listings");
  });
});
