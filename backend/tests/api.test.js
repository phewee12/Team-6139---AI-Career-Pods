import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { config } from "../src/config.js";
import { prisma } from "../src/lib/prisma.js";

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

describe("Health Endpoint", () => {
  it("returns service health", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});

describe("Auth Endpoints", () => {
  it("registers a new user and sets auth cookie", async () => {
    const response = await request(app).post("/api/auth/register").send({
      fullName: "Test Student",
      email: "Student@Example.com",
      password: "Password123",
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe("student@example.com");
    expect(response.headers["set-cookie"]?.join(";")).toContain(`${config.authCookieName}=`);
  });

  it("blocks duplicate registration", async () => {
    await request(app).post("/api/auth/register").send({
      fullName: "Test Student",
      email: "student@example.com",
      password: "Password123",
    });

    const duplicate = await request(app).post("/api/auth/register").send({
      fullName: "Test Student",
      email: "student@example.com",
      password: "Password123",
    });

    expect(duplicate.status).toBe(409);
  });

  it("logs in an existing local user", async () => {
    const passwordHash = await bcrypt.hash("Password123", 12);
    await prisma.user.create({
      data: {
        fullName: "Existing User",
        email: "existing@example.com",
        passwordHash,
        authProvider: "LOCAL",
      },
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "existing@example.com",
      password: "Password123",
    });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe("existing@example.com");
    expect(response.headers["set-cookie"]?.join(";")).toContain(`${config.authCookieName}=`);
  });

  it("rejects login with wrong password", async () => {
    const passwordHash = await bcrypt.hash("Password123", 12);
    await prisma.user.create({
      data: {
        email: "existing@example.com",
        passwordHash,
        authProvider: "LOCAL",
      },
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "existing@example.com",
      password: "WrongPassword123",
    });

    expect(response.status).toBe(401);
  });

  it("rejects password login for oauth users", async () => {
    await prisma.user.create({
      data: {
        email: "oauth@example.com",
        authProvider: "GOOGLE",
      },
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "oauth@example.com",
      password: "Password123",
    });

    expect(response.status).toBe(400);
  });

  it("returns current user for valid session", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Session User",
      email: "session@example.com",
      password: "Password123",
    });

    const cookie = registration.headers["set-cookie"];
    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("session@example.com");
  });

  it("rejects /me without session", async () => {
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(401);
  });

  it("clears auth cookie on logout", async () => {
    const response = await request(app).post("/api/auth/logout");

    expect(response.status).toBe(200);
    expect(response.headers["set-cookie"]?.join(";")).toContain(`${config.authCookieName}=`);
  });

  it("returns 501 for google auth when credentials are missing", async () => {
    const response = await request(app).get("/api/auth/google");
    expect(response.status).toBe(501);
  });

  it("redirects google callback with config error when credentials are missing", async () => {
    const response = await request(app).get("/api/auth/google/callback");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(`${config.clientOrigin}/auth?error=google_not_configured`);
  });
});

describe("User Endpoints", () => {
  it("rejects profile update without authentication", async () => {
    const response = await request(app).put("/api/users/profile").send({
      fieldOfStudy: "Computer Science",
      careerStage: "Junior",
      targetTimeline: "6 months",
    });

    expect(response.status).toBe(401);
  });

  it("updates authenticated user profile", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Profile User",
      email: "profile@example.com",
      password: "Password123",
    });

    const cookie = registration.headers["set-cookie"];

    const response = await request(app)
      .put("/api/users/profile")
      .set("Cookie", cookie)
      .send({
        fieldOfStudy: "Computer Science",
        careerStage: "Junior",
        targetTimeline: "6 months",
      });

    expect(response.status).toBe(200);
    expect(response.body.user.fieldOfStudy).toBe("Computer Science");
    expect(response.body.user.careerStage).toBe("Junior");
    expect(response.body.user.targetTimeline).toBe("6 months");
  });

  it("validates profile input", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Profile User",
      email: "profile@example.com",
      password: "Password123",
    });

    const cookie = registration.headers["set-cookie"];

    const response = await request(app)
      .put("/api/users/profile")
      .set("Cookie", cookie)
      .send({
        fieldOfStudy: "CS",
      });

    expect(response.status).toBe(400);
  });
});

describe("Pod Endpoints", () => {
  it("rejects pods fetch without authentication", async () => {
    const response = await request(app).get("/api/pods");

    expect(response.status).toBe(401);
  });

  it("returns default pods for authenticated users", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Pods User",
      email: "pods@example.com",
      password: "Password123",
    });

    const cookie = registration.headers["set-cookie"];
    const response = await request(app).get("/api/pods").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.pods)).toBe(true);
    expect(response.body.pods.length).toBeGreaterThanOrEqual(3);
    expect(response.body.pods.map((pod) => pod.slug)).toEqual(
      expect.arrayContaining([
        "internship-accelerator",
        "grad-school-strategy",
        "career-switch-lab",
      ]),
    );
  });
});
