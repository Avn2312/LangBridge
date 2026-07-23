import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app;

beforeAll(async () => {
  process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-jwt-secret";
  process.env.SESSION_SECRET =
    process.env.SESSION_SECRET || "test-session-secret";
  process.env.BASE_URL = "http://localhost:3000";
  process.env.FRONTEND_URL = "http://localhost:5173";
  process.env.CORS_ORIGINS = "http://localhost:5173";
  process.env.GOOGLE_CLIENT_ID =
    process.env.GOOGLE_CLIENT_ID || "test-google-client-id";
  process.env.GOOGLE_CLIENT_SECRET =
    process.env.GOOGLE_CLIENT_SECRET || "test-google-client-secret";
  process.env.GOOGLE_CALLBACK_URL =
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:3000/api/auth/google/callback";

  ({ default: app } = await import("./app.js"));
});

describe("app smoke routes", () => {
  it("returns liveness status", async () => {
    const response = await request(app).get("/healthz").expect(200);

    expect(response.body).toMatchObject({
      status: "ok",
      service: "langbridge-api",
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
    expect(response.body.uptimeSeconds).toEqual(expect.any(Number));
  });

  it("returns readiness with dependency details", async () => {
    const response = await request(app).get("/readyz").expect(503);

    expect(response.body).toMatchObject({
      status: "degraded",
      service: "langbridge-api",
      dependencies: {
        mongo: "degraded",
        redis: "ok",
        sessionRedis: "ok",
      },
    });
  });

  it("returns Prometheus-style metrics", async () => {
    const response = await request(app).get("/metrics").expect(200);

    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toContain("http_requests_total");
    expect(response.text).toContain("process_uptime_seconds");
  });

  it("returns JSON for unknown API routes", async () => {
    const response = await request(app).get("/api/not-a-route").expect(404);

    expect(response.body).toEqual({
      success: false,
      message: "API route not found.",
      code: "NOT_FOUND",
    });
  });
});

describe("auth and request middleware", () => {
  it("rejects protected routes without a token", async () => {
    const response = await request(app).get("/api/auth/me").expect(401);

    expect(response.body).toMatchObject({
      success: false,
      code: "AUTH_TOKEN_MISSING",
    });
  });

  it("rejects malformed JSON through the shared error handler", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{")
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
    });
  });

  it("returns a specific signup validation message", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "Asha Rao",
        email: "asha@example.com",
        password: "password",
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      code: "VALIDATION_ERROR",
      message:
        "password should be at least 8 characters long and contain at least one uppercase letter and one number",
    });
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "password",
        }),
      ]),
    );
  });

  it("allows configured frontend origins through CORS", async () => {
    const response = await request(app)
      .options("/api/auth/me")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET")
      .expect(204);

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });
});
