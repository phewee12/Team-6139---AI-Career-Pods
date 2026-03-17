import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { config } from "../src/config.js";
import { prisma } from "../src/lib/prisma.js";

beforeEach(async () => {
  await prisma.podPost.deleteMany();
  await prisma.podMembership.deleteMany();
  await prisma.pod.deleteMany({
    where: { isDefault: false },
  });
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.podPost.deleteMany();
  await prisma.podMembership.deleteMany();
  await prisma.pod.deleteMany({
    where: { isDefault: false },
  });
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
        avatarUrl: "https://images.example.com/profile-student.png",
      });

    expect(response.status).toBe(200);
    expect(response.body.user.fieldOfStudy).toBe("Computer Science");
    expect(response.body.user.careerStage).toBe("Junior");
    expect(response.body.user.targetTimeline).toBe("6 months");
    expect(response.body.user.avatarUrl).toBe("https://images.example.com/profile-student.png");
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

  it("stores uploaded avatar image data and serves it via avatar endpoint", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Avatar User",
      email: "avatar-user@example.com",
      password: "Password123",
    });

    const cookie = registration.headers["set-cookie"];
    const tinyGifDataUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

    const profileResponse = await request(app)
      .put("/api/users/profile")
      .set("Cookie", cookie)
      .send({
        fieldOfStudy: "Information Systems",
        careerStage: "Junior",
        targetTimeline: "6 months",
        avatarUploadData: tinyGifDataUrl,
        avatarUploadContentType: "image/gif",
      });

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.user.hasAvatarUpload).toBe(true);
    expect(profileResponse.body.user.avatarImageUrl).toContain("/api/users/");

    const avatarResponse = await request(app)
      .get(`/api/users/${profileResponse.body.user.id}/avatar`)
      .set("Cookie", cookie);

    expect(avatarResponse.status).toBe(200);
    expect(avatarResponse.headers["content-type"]).toContain("image/gif");
    expect(avatarResponse.body.length).toBeGreaterThan(0);
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
    expect(response.body.pods[0]).toMatchObject({
      visibility: expect.any(String),
      joinActionLabel: expect.any(String),
      memberCount: expect.any(Number),
    });
  });

  it("joins public pods immediately with ACTIVE membership", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Join User",
      email: "joiner@example.com",
      password: "Password123",
    });

    const cookie = registration.headers["set-cookie"];
    const podsResponse = await request(app).get("/api/pods").set("Cookie", cookie);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    const joinResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/join`)
      .set("Cookie", cookie);

    expect(joinResponse.status).toBe(200);
    expect(joinResponse.body.membership.status).toBe("ACTIVE");

    const refreshedPods = await request(app).get("/api/pods").set("Cookie", cookie);
    const refreshedPod = refreshedPods.body.pods.find((pod) => pod.id === publicPod.id);

    expect(refreshedPod.membershipStatus).toBe("ACTIVE");
  });

  it("creates private pods and handles join requests as PENDING", async () => {
    const creatorRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Private Creator",
      email: "creator@example.com",
      password: "Password123",
    });

    const creatorCookie = creatorRegistration.headers["set-cookie"];

    const createdPodResponse = await request(app)
      .post("/api/pods")
      .set("Cookie", creatorCookie)
      .send({
        name: "Private Pod Alpha",
        description: "Private collaboration space for approval-based membership.",
        focusArea: "Leadership",
        visibility: "PRIVATE",
      });

    expect(createdPodResponse.status).toBe(201);
    expect(createdPodResponse.body.pod.visibility).toBe("PRIVATE");
    expect(createdPodResponse.body.pod.membershipRole).toBe("ADMIN");

    const memberRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Private Joiner",
      email: "private-joiner@example.com",
      password: "Password123",
    });

    const memberCookie = memberRegistration.headers["set-cookie"];

    const joinResponse = await request(app)
      .post(`/api/pods/${createdPodResponse.body.pod.id}/join`)
      .set("Cookie", memberCookie);

    expect(joinResponse.status).toBe(202);
    expect(joinResponse.body.membership.status).toBe("PENDING");
  });

  it("allows admin to review and approve pending membership requests", async () => {
    const creatorRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Approval Creator",
      email: "approval-creator@example.com",
      password: "Password123",
    });

    const creatorCookie = creatorRegistration.headers["set-cookie"];

    const createdPodResponse = await request(app)
      .post("/api/pods")
      .set("Cookie", creatorCookie)
      .send({
        name: "Private Approval Pod",
        description: "Private pod for approval workflow testing and moderation.",
        focusArea: "Career",
        visibility: "PRIVATE",
      });

    const memberRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Pending Member",
      email: "pending-member@example.com",
      password: "Password123",
    });

    const memberCookie = memberRegistration.headers["set-cookie"];

    await request(app)
      .post(`/api/pods/${createdPodResponse.body.pod.id}/join`)
      .set("Cookie", memberCookie);

    const pendingRequestsResponse = await request(app)
      .get(`/api/pods/${createdPodResponse.body.pod.id}/requests`)
      .set("Cookie", creatorCookie);

    expect(pendingRequestsResponse.status).toBe(200);
    expect(pendingRequestsResponse.body.requests.length).toBe(1);
    const pendingRequest = pendingRequestsResponse.body.requests[0];

    const approvalResponse = await request(app)
      .patch(`/api/pods/${createdPodResponse.body.pod.id}/requests/${pendingRequest.id}`)
      .set("Cookie", creatorCookie)
      .send({ action: "approve" });

    expect(approvalResponse.status).toBe(200);
    expect(approvalResponse.body.membership.status).toBe("ACTIVE");

    const memberPodsResponse = await request(app).get("/api/pods").set("Cookie", memberCookie);
    const memberPod = memberPodsResponse.body.pods.find(
      (pod) => pod.id === createdPodResponse.body.pod.id,
    );

    expect(memberPod.membershipStatus).toBe("ACTIVE");
  });

  it("blocks non-admin users from reviewing pending membership requests", async () => {
    const creatorRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Moderation Creator",
      email: "moderation-creator@example.com",
      password: "Password123",
    });

    const creatorCookie = creatorRegistration.headers["set-cookie"];

    const createdPodResponse = await request(app)
      .post("/api/pods")
      .set("Cookie", creatorCookie)
      .send({
        name: "Private Moderation Pod",
        description: "Private pod to verify authorization checks for request handling.",
        focusArea: "Community",
        visibility: "PRIVATE",
      });

    const requesterRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Requester",
      email: "requester@example.com",
      password: "Password123",
    });

    const requesterCookie = requesterRegistration.headers["set-cookie"];

    await request(app)
      .post(`/api/pods/${createdPodResponse.body.pod.id}/join`)
      .set("Cookie", requesterCookie);

    const randomUserRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Not Admin",
      email: "not-admin@example.com",
      password: "Password123",
    });

    const randomUserCookie = randomUserRegistration.headers["set-cookie"];

    const pendingRequestsResponse = await request(app)
      .get(`/api/pods/${createdPodResponse.body.pod.id}/requests`)
      .set("Cookie", randomUserCookie);

    expect(pendingRequestsResponse.status).toBe(403);
  });

  it("allows active members to create and fetch pod posts", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Posting Member",
      email: "posting-member@example.com",
      password: "Password123",
    });

    const cookie = registration.headers["set-cookie"];
    const podsResponse = await request(app).get("/api/pods").set("Cookie", cookie);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", cookie);

    const createPostResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/posts`)
      .set("Cookie", cookie)
      .send({ content: "Excited to start collaborating with everyone here." });

    expect(createPostResponse.status).toBe(201);
    expect(createPostResponse.body.post.content).toBe(
      "Excited to start collaborating with everyone here.",
    );

    const fetchPostsResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/posts`)
      .set("Cookie", cookie);

    expect(fetchPostsResponse.status).toBe(200);
    expect(fetchPostsResponse.body.posts.length).toBeGreaterThan(0);
    expect(fetchPostsResponse.body.posts[0].content).toBe(
      "Excited to start collaborating with everyone here.",
    );
  });

  it("allows members to leave a joined group", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Leaving Member",
      email: "leaving-member@example.com",
      password: "Password123",
    });

    const cookie = registration.headers["set-cookie"];
    const podsResponse = await request(app).get("/api/pods").set("Cookie", cookie);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", cookie);

    const leaveResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/leave`)
      .set("Cookie", cookie);

    expect(leaveResponse.status).toBe(200);

    const refreshedPodsResponse = await request(app).get("/api/pods").set("Cookie", cookie);
    const refreshedPod = refreshedPodsResponse.body.pods.find((pod) => pod.id === publicPod.id);
    expect(refreshedPod.membershipStatus).toBeNull();
  });

  it("allows deleting own posts and blocks deleting others' posts", async () => {
    const authorRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Post Author",
      email: "post-author@example.com",
      password: "Password123",
    });
    const authorCookie = authorRegistration.headers["set-cookie"];

    const otherRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Other Member",
      email: "other-member@example.com",
      password: "Password123",
    });
    const otherCookie = otherRegistration.headers["set-cookie"];

    const podsResponse = await request(app).get("/api/pods").set("Cookie", authorCookie);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", authorCookie);
    await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", otherCookie);

    const createPostResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/posts`)
      .set("Cookie", authorCookie)
      .send({ content: "This is my post to delete." });

    expect(createPostResponse.status).toBe(201);
    const createdPost = createPostResponse.body.post;

    const forbiddenDeleteResponse = await request(app)
      .delete(`/api/pods/${publicPod.id}/posts/${createdPost.id}`)
      .set("Cookie", otherCookie);

    expect(forbiddenDeleteResponse.status).toBe(403);

    const deleteResponse = await request(app)
      .delete(`/api/pods/${publicPod.id}/posts/${createdPost.id}`)
      .set("Cookie", authorCookie);

    expect(deleteResponse.status).toBe(200);

    const postsResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/posts`)
      .set("Cookie", authorCookie);

    expect(postsResponse.status).toBe(200);
    expect(postsResponse.body.posts.some((post) => post.id === createdPost.id)).toBe(false);
  });

  it("blocks non-members from creating pod posts", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Non Member",
      email: "non-member@example.com",
      password: "Password123",
    });

    const cookie = registration.headers["set-cookie"];

    const creatorRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Private Post Creator",
      email: "private-post-creator@example.com",
      password: "Password123",
    });

    const creatorCookie = creatorRegistration.headers["set-cookie"];

    const createdPodResponse = await request(app)
      .post("/api/pods")
      .set("Cookie", creatorCookie)
      .send({
        name: "Private Posts Pod",
        description: "Private pod where only active members can create posts.",
        focusArea: "Leadership",
        visibility: "PRIVATE",
      });

    const createPostResponse = await request(app)
      .post(`/api/pods/${createdPodResponse.body.pod.id}/posts`)
      .set("Cookie", cookie)
      .send({ content: "Trying to post without joining should fail." });

    expect(createPostResponse.status).toBe(403);
  });

  it("returns active pod members with profile details", async () => {
    const firstUser = await request(app).post("/api/auth/register").send({
      fullName: "Member One",
      email: "member-one@example.com",
      password: "Password123",
    });
    const firstCookie = firstUser.headers["set-cookie"];

    await request(app)
      .put("/api/users/profile")
      .set("Cookie", firstCookie)
      .send({
        fieldOfStudy: "Computer Science",
        careerStage: "Senior",
        targetTimeline: "3 months",
        avatarUrl: "https://images.example.com/member-one.png",
      });

    const secondUser = await request(app).post("/api/auth/register").send({
      fullName: "Member Two",
      email: "member-two@example.com",
      password: "Password123",
    });
    const secondCookie = secondUser.headers["set-cookie"];

    const podsResponse = await request(app).get("/api/pods").set("Cookie", firstCookie);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", firstCookie);
    await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", secondCookie);

    const membersResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/members`)
      .set("Cookie", firstCookie);

    expect(membersResponse.status).toBe(200);
    expect(membersResponse.body.members.length).toBeGreaterThanOrEqual(2);

    const firstMember = membersResponse.body.members.find((member) => member.email === "member-one@example.com");
    expect(firstMember).toBeTruthy();
    expect(firstMember.fieldOfStudy).toBe("Computer Science");
    expect(firstMember.careerStage).toBe("Senior");
    expect(firstMember.targetTimeline).toBe("3 months");
    expect(firstMember.avatarUrl).toBe("https://images.example.com/member-one.png");
  });

  it("creates an onboarding feed post when onboarding is completed", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Onboarding Member",
      email: "onboarding-member@example.com",
      password: "Password123",
    });

    const cookie = registration.headers["set-cookie"];
    const podsResponse = await request(app).get("/api/pods").set("Cookie", cookie);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", cookie);

    const introMessage = "Hi team, excited to learn and contribute each week.";
    const onboardingResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/onboarding`)
      .set("Cookie", cookie)
      .send({ introMessage });

    expect(onboardingResponse.status).toBe(200);

    const postsResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/posts`)
      .set("Cookie", cookie);

    expect(postsResponse.status).toBe(200);
    expect(postsResponse.body.posts.length).toBeGreaterThan(0);
    expect(postsResponse.body.posts[0].content).toContain("Onboarding Member joined the pod. Intro:");
    expect(postsResponse.body.posts[0].content).toContain(introMessage);
  });
});
