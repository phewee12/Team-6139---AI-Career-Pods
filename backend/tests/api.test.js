import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { mockUpload, setUploadError, resetUploadMock, mockCreateSignedUrl, resetSignedUrlMock } = vi.hoisted(() => {
  let uploadError = null;
  let signUrlError = null;

  const uploadMock = vi.fn(async () => ({
    data: { path: "mock/path/resume.pdf" },
    error: uploadError,
  }));

  const signUrlMock = vi.fn(async () => ({
    data: { signedUrl: "https://signed.example/resume.pdf" },
    error: signUrlError,
  }));

  return {
    mockUpload: uploadMock,
    mockCreateSignedUrl: signUrlMock,
    setUploadError: (value) => {
      uploadError = value;
    },
    resetUploadMock: () => {
      uploadError = null;
      uploadMock.mockClear();
    },
    resetSignedUrlMock: () => {
      signUrlError = null;
      signUrlMock.mockClear();
    },
  };
});

vi.mock("../src/lib/supabase.js", () => ({
  getSupabaseClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  }),
}));

import { app } from "../src/app.js";
import { config } from "../src/config.js";
import { prisma } from "../src/lib/prisma.js";

const sampleResumePayload = {
  fileName: "resume.pdf",
  mimeType: "application/pdf",
  contentBase64: "JVBERi0xLjQKJQ==",
};

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueEmail(prefix) {
  return `${prefix}-${uniqueSuffix()}@example.com`;
}

beforeEach(async () => {
  resetUploadMock();
  resetSignedUrlMock();
  await prisma.podBiweeklySummary.deleteMany();
  await prisma.podResumeReviewFeedback.deleteMany();
  await prisma.podResumeFile.deleteMany();
  await prisma.podResumeReviewRequest.deleteMany();
  await prisma.podPost.deleteMany();
  await prisma.podMembership.deleteMany();
  await prisma.pod.deleteMany({
    where: { isDefault: false },
  });
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.podBiweeklySummary.deleteMany();
  await prisma.podResumeReviewFeedback.deleteMany();
  await prisma.podResumeFile.deleteMany();
  await prisma.podResumeReviewRequest.deleteMany();
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

describe("Admin Endpoints", () => {
  it("blocks test DB reset when feature flag is disabled", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Admin Guard User",
      email: "admin-guard@example.com",
      password: "Password123",
    });

    const cookie = registration.headers["set-cookie"];

    const response = await request(app)
      .post("/api/admin/test/reset-db")
      .set("Cookie", cookie)
      .send({ confirmText: "RESET DATABASE" });

    expect(response.status).toBe(403);
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
    const email = uniqueEmail("avatar-user");
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Avatar User",
      email,
      password: "Password123",
    });

    expect(registration.status).toBe(201);

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
  function getBiWeeklyStartDate(date) {
    const d = new Date(date);
    const daysSinceEpoch = Math.floor(d.getTime() / (1000 * 60 * 60 * 24));
    const biWeeklyOffset = daysSinceEpoch % 14;
    d.setDate(d.getDate() - biWeeklyOffset);
    d.setHours(0, 0, 0, 0);
    return d;
  }

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
    const email = uniqueEmail("joiner");
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Join User",
      email,
      password: "Password123",
    });

    expect(registration.status).toBe(201);

    const cookie = registration.headers["set-cookie"];
    const podsResponse = await request(app).get("/api/pods").set("Cookie", cookie);
    expect(podsResponse.status).toBe(200);
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
    expect(createdPodResponse.body.pod.membershipRole).toBe("OWNER");

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
  }, 15000);

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

  it("creates and lists resume review requests for active members", async () => {
    const requesterRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Resume Requester",
      email: "resume-requester@example.com",
      password: "Password123",
    });
    const requesterCookie = requesterRegistration.headers["set-cookie"];

    const reviewerRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Resume Reviewer",
      email: "resume-reviewer@example.com",
      password: "Password123",
    });
    const reviewerCookie = reviewerRegistration.headers["set-cookie"];

    const podsResponse = await request(app).get("/api/pods").set("Cookie", requesterCookie);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", requesterCookie);
    await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", reviewerCookie);

    const createResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/resume-reviews`)
      .set("Cookie", requesterCookie)
      .send({
        title: "SWE Internship Resume",
        targetRole: "Software Engineer Intern",
        context: "Preparing for fall internship applications.",
        ...sampleResumePayload,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.reviewRequest.title).toBe("SWE Internship Resume");
    expect(createResponse.body.reviewRequest.requester.email).toBe("resume-requester@example.com");

    const reviewerListResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/resume-reviews`)
      .set("Cookie", reviewerCookie);

    expect(reviewerListResponse.status).toBe(200);
    expect(reviewerListResponse.body.reviewRequests.length).toBe(1);
    expect(reviewerListResponse.body.reviewRequests[0].feedback).toEqual([]);
    expect(reviewerListResponse.body.reviewRequests[0].feedbackCount).toBe(0);
    expect(reviewerListResponse.body.reviewRequests[0].hasCurrentUserFeedback).toBe(false);
    expect(reviewerListResponse.body.reviewRequests[0].canCurrentUserReview).toBe(true);
  });

  it("rejects self-review, allows peer feedback, and lets requester fetch feedback", async () => {
    const requesterRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Feedback Requester",
      email: "feedback-requester@example.com",
      password: "Password123",
    });
    const requesterCookie = requesterRegistration.headers["set-cookie"];

    const reviewerRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Feedback Reviewer",
      email: "feedback-reviewer@example.com",
      password: "Password123",
    });
    const reviewerCookie = reviewerRegistration.headers["set-cookie"];

    const podsResponse = await request(app).get("/api/pods").set("Cookie", requesterCookie);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", requesterCookie);
    await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", reviewerCookie);

    const reviewRequestResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/resume-reviews`)
      .set("Cookie", requesterCookie)
      .send({ title: "Backend Engineer Resume", ...sampleResumePayload });

    const reviewRequestId = reviewRequestResponse.body.reviewRequest.id;

    const selfFeedbackResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/resume-reviews/${reviewRequestId}/feedback`)
      .set("Cookie", requesterCookie)
      .send({
        strengths: "Strong technical projects.",
        improvements: "Could add more metrics.",
      });

    expect(selfFeedbackResponse.status).toBe(403);

    const reviewerFeedbackResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/resume-reviews/${reviewRequestId}/feedback`)
      .set("Cookie", reviewerCookie)
      .send({
        overallScore: 4,
        strengths: "Clear project bullets.",
        improvements: "Add quantified impact where possible.",
        recommendation: "YES_WITH_EDITS",
      });

    expect(reviewerFeedbackResponse.status).toBe(200);
    expect(reviewerFeedbackResponse.body.feedback.reviewer.email).toBe("feedback-reviewer@example.com");
    expect(reviewerFeedbackResponse.body.feedback.recommendation).toBe("YES_WITH_EDITS");

    const reviewerListAfterFeedback = await request(app)
      .get(`/api/pods/${publicPod.id}/resume-reviews`)
      .set("Cookie", reviewerCookie);

    expect(reviewerListAfterFeedback.status).toBe(200);
    expect(reviewerListAfterFeedback.body.reviewRequests[0].feedbackCount).toBe(1);
    expect(reviewerListAfterFeedback.body.reviewRequests[0].hasCurrentUserFeedback).toBe(true);
    expect(reviewerListAfterFeedback.body.reviewRequests[0].canCurrentUserReview).toBe(false);

    const requesterFeedbackView = await request(app)
      .get(`/api/pods/${publicPod.id}/resume-reviews/${reviewRequestId}/feedback`)
      .set("Cookie", requesterCookie);

    expect(requesterFeedbackView.status).toBe(200);
    expect(requesterFeedbackView.body.feedback.length).toBe(1);
    expect(requesterFeedbackView.body.feedback[0].reviewer.email).toBe("feedback-reviewer@example.com");
  }, 15000);

  it("allows requester to close a resume review request", async () => {
    const requesterRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Status Requester",
      email: "status-requester@example.com",
      password: "Password123",
    });
    const requesterCookie = requesterRegistration.headers["set-cookie"];

    const podsResponse = await request(app).get("/api/pods").set("Cookie", requesterCookie);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", requesterCookie);

    const reviewRequestResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/resume-reviews`)
      .set("Cookie", requesterCookie)
      .send({ title: "Data Analyst Resume", ...sampleResumePayload });

    const reviewRequestId = reviewRequestResponse.body.reviewRequest.id;

    const closeResponse = await request(app)
      .patch(`/api/pods/${publicPod.id}/resume-reviews/${reviewRequestId}/status`)
      .set("Cookie", requesterCookie)
      .send({ status: "CLOSED" });

    expect(closeResponse.status).toBe(200);
    expect(closeResponse.body.reviewRequest.status).toBe("CLOSED");
    expect(closeResponse.body.reviewRequest.closedAt).toBeTruthy();
  });

  it("rejects creating a resume review request without a PDF", async () => {
    const requesterRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Missing PDF Requester",
      email: "missing-pdf-requester@example.com",
      password: "Password123",
    });
    const requesterCookie = requesterRegistration.headers["set-cookie"];

    const podsResponse = await request(app).get("/api/pods").set("Cookie", requesterCookie);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", requesterCookie);

    const createResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/resume-reviews`)
      .set("Cookie", requesterCookie)
      .send({
        title: "Missing PDF Resume",
      });

    expect(createResponse.status).toBe(400);
    expect(createResponse.body.message).toBe("Invalid resume review payload.");
  });

  it("uploads a resume PDF file for a review request", async () => {
    setUploadError(null);

    const requesterRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Upload Requester",
      email: "upload-requester@example.com",
      password: "Password123",
    });
    const requesterCookie = requesterRegistration.headers["set-cookie"];

    const podsResponse = await request(app).get("/api/pods").set("Cookie", requesterCookie);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", requesterCookie);

    const reviewRequestResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/resume-reviews`)
      .set("Cookie", requesterCookie)
      .send({ title: "Upload Ready Resume", ...sampleResumePayload });

    const reviewRequestId = reviewRequestResponse.body.reviewRequest.id;

    const uploadResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/resume-reviews/${reviewRequestId}/file`)
      .set("Cookie", requesterCookie)
      .send(sampleResumePayload);

    expect(uploadResponse.status).toBe(200);
    expect(uploadResponse.body.file.requestId).toBe(reviewRequestId);
    expect(uploadResponse.body.file.mimeType).toBe("application/pdf");
    expect(uploadResponse.body.file.sizeBytes).toBeGreaterThan(0);
    expect(mockUpload).toHaveBeenCalledTimes(2);
  });

  it("allows requester to delete a resume review request", async () => {
    const requesterEmail = uniqueEmail("delete-requester");
    const requesterRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Delete Requester",
      email: requesterEmail,
      password: "Password123",
    });
    expect(requesterRegistration.status).toBe(201);
    const requesterCookie = requesterRegistration.headers["set-cookie"];

    const podsResponse = await request(app).get("/api/pods").set("Cookie", requesterCookie);
    expect(podsResponse.status).toBe(200);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    const joinResponse = await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", requesterCookie);
    expect(joinResponse.status).toBe(200);

    const reviewRequestResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/resume-reviews`)
      .set("Cookie", requesterCookie)
      .send({ title: "Delete Me", ...sampleResumePayload });
    expect(reviewRequestResponse.status).toBe(201);

    const reviewRequestId = reviewRequestResponse.body.reviewRequest.id;

    const deleteResponse = await request(app)
      .delete(`/api/pods/${publicPod.id}/resume-reviews/${reviewRequestId}`)
      .set("Cookie", requesterCookie);

    expect(deleteResponse.status).toBe(200);

    const detailResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/resume-reviews/${reviewRequestId}`)
      .set("Cookie", requesterCookie);

    expect(detailResponse.status).toBe(404);
  });

  it("returns a signed URL for resume PDF to active pod members", async () => {
    const requesterEmail = uniqueEmail("url-requester");
    const requesterRegistration = await request(app).post("/api/auth/register").send({
      fullName: "URL Requester",
      email: requesterEmail,
      password: "Password123",
    });
    expect(requesterRegistration.status).toBe(201);
    const requesterCookie = requesterRegistration.headers["set-cookie"];

    const reviewerEmail = uniqueEmail("url-reviewer");
    const reviewerRegistration = await request(app).post("/api/auth/register").send({
      fullName: "URL Reviewer",
      email: reviewerEmail,
      password: "Password123",
    });
    expect(reviewerRegistration.status).toBe(201);
    const reviewerCookie = reviewerRegistration.headers["set-cookie"];

    const podsResponse = await request(app).get("/api/pods").set("Cookie", requesterCookie);
    expect(podsResponse.status).toBe(200);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    const requesterJoin = await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", requesterCookie);
    const reviewerJoin = await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", reviewerCookie);
    expect(requesterJoin.status).toBe(200);
    expect(reviewerJoin.status).toBe(200);

    const reviewRequestResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/resume-reviews`)
      .set("Cookie", requesterCookie)
      .send({ title: "Signed URL Resume", ...sampleResumePayload });
    expect(reviewRequestResponse.status).toBe(201);

    const reviewRequestId = reviewRequestResponse.body.reviewRequest.id;

    const urlResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/resume-reviews/${reviewRequestId}/file-url`)
      .set("Cookie", reviewerCookie);

    expect(urlResponse.status).toBe(200);
    expect(urlResponse.body.signedUrl).toContain("https://");
    expect(urlResponse.body.expiresInSeconds).toBe(600);
    expect(urlResponse.body.file.originalFileName).toBe("resume.pdf");
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("blocks non-members from accessing signed URL for resume PDF", async () => {
    const requesterEmail = uniqueEmail("url-owner");
    const requesterRegistration = await request(app).post("/api/auth/register").send({
      fullName: "URL Owner",
      email: requesterEmail,
      password: "Password123",
    });
    expect(requesterRegistration.status).toBe(201);
    const requesterCookie = requesterRegistration.headers["set-cookie"];

    const outsiderEmail = uniqueEmail("url-outsider");
    const outsiderRegistration = await request(app).post("/api/auth/register").send({
      fullName: "URL Outsider",
      email: outsiderEmail,
      password: "Password123",
    });
    expect(outsiderRegistration.status).toBe(201);
    const outsiderCookie = outsiderRegistration.headers["set-cookie"];

    const podsResponse = await request(app).get("/api/pods").set("Cookie", requesterCookie);
    expect(podsResponse.status).toBe(200);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    const requesterJoin = await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", requesterCookie);
    expect(requesterJoin.status).toBe(200);

    const reviewRequestResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/resume-reviews`)
      .set("Cookie", requesterCookie)
      .send({ title: "Protected Resume", ...sampleResumePayload });
    expect(reviewRequestResponse.status).toBe(201);

    const reviewRequestId = reviewRequestResponse.body.reviewRequest.id;

    const urlResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/resume-reviews/${reviewRequestId}/file-url`)
      .set("Cookie", outsiderCookie);

    expect(urlResponse.status).toBe(403);
  });

  it("returns the current user's submitted feedback via my-feedback endpoint", async () => {
    const requesterEmail = uniqueEmail("my-feedback-requester");
    const requesterRegistration = await request(app).post("/api/auth/register").send({
      fullName: "My Feedback Requester",
      email: requesterEmail,
      password: "Password123",
    });
    expect(requesterRegistration.status).toBe(201);
    const requesterCookie = requesterRegistration.headers["set-cookie"];

    const reviewerEmail = uniqueEmail("my-feedback-reviewer");
    const reviewerRegistration = await request(app).post("/api/auth/register").send({
      fullName: "My Feedback Reviewer",
      email: reviewerEmail,
      password: "Password123",
    });
    expect(reviewerRegistration.status).toBe(201);
    const reviewerCookie = reviewerRegistration.headers["set-cookie"];

    const podsResponse = await request(app).get("/api/pods").set("Cookie", requesterCookie);
    expect(podsResponse.status).toBe(200);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    const requesterJoin = await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", requesterCookie);
    const reviewerJoin = await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", reviewerCookie);
    expect(requesterJoin.status).toBe(200);
    expect(reviewerJoin.status).toBe(200);

    const reviewRequestResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/resume-reviews`)
      .set("Cookie", requesterCookie)
      .send({ title: "My Feedback Resume", ...sampleResumePayload });
    expect(reviewRequestResponse.status).toBe(201);

    const reviewRequestId = reviewRequestResponse.body.reviewRequest.id;

    const reviewerFeedbackResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/resume-reviews/${reviewRequestId}/feedback`)
      .set("Cookie", reviewerCookie)
      .send({
        strengths: "Solid formatting and structure.",
        improvements: "Add quantified outcomes to top bullets.",
      });
    
    expect(reviewerFeedbackResponse.status).toBe(200);

    const myFeedbackResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/resume-reviews/${reviewRequestId}/my-feedback`)
      .set("Cookie", reviewerCookie);

    expect(myFeedbackResponse.status).toBe(200);
    expect(myFeedbackResponse.body.feedback.reviewer.email).toBe(reviewerEmail);
    expect(myFeedbackResponse.body.feedback.strengths).toContain("Solid formatting");
  }, 15000);

  it("supports core bi-weekly ritual endpoints", async () => {
    const ritualEmail = uniqueEmail("ritual-member");
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Ritual Member",
      email: ritualEmail,
      password: "Password123",
    });
    expect(registration.status).toBe(201);
    const cookie = registration.headers["set-cookie"];

    const podsResponse = await request(app).get("/api/pods").set("Cookie", cookie);
    expect(podsResponse.status).toBe(200);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    const joinResponse = await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", cookie);
    expect(joinResponse.status).toBe(200);

    const currentResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/checkin/current`)
      .set("Cookie", cookie);

    expect(currentResponse.status).toBe(200);
    expect(currentResponse.body).toHaveProperty("isActive");

    const checkInResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/checkin`)
      .set("Cookie", cookie)
      .send({ notes: "Completed mock applications.", goals: "Refine interview stories." });

    expect(checkInResponse.status).toBe(200);
    expect(checkInResponse.body.checkIn.status).toBe("COMPLETED");

    const reflectionResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/reflection`)
      .set("Cookie", cookie)
      .send({ content: "Great momentum this week and clearer focus areas." });

    expect(reflectionResponse.status).toBe(200);
    expect(reflectionResponse.body.reflection.content).toContain("Great momentum");

    const celebrationResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/celebrations`)
      .set("Cookie", cookie)
      .send({ title: "Interview Invite", description: "Received a callback from a target company." });

    expect(celebrationResponse.status).toBe(201);
    expect(celebrationResponse.body.celebration.title).toBe("Interview Invite");

    const checkInsResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/checkins`)
      .set("Cookie", cookie);

    expect(checkInsResponse.status).toBe(200);
    expect(checkInsResponse.body.checkIns.length).toBeGreaterThanOrEqual(1);

    const reflectionsResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/reflections`)
      .set("Cookie", cookie);

    expect(reflectionsResponse.status).toBe(200);
    expect(reflectionsResponse.body.reflections.length).toBeGreaterThanOrEqual(1);

    const celebrationsResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/celebrations/all`)
      .set("Cookie", cookie);

    expect(celebrationsResponse.status).toBe(200);
    expect(celebrationsResponse.body.celebrations.length).toBeGreaterThanOrEqual(1);

    const phaseResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/phase`)
      .set("Cookie", cookie);

    expect(phaseResponse.status).toBe(200);
    expect(phaseResponse.body).toHaveProperty("phase");
    expect(phaseResponse.body).toHaveProperty("prompt");

    const statsResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/stats`)
      .set("Cookie", cookie);

    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body.currentWeek.total_checkins).toBeGreaterThanOrEqual(1);
  }, 15000);

  it("lists notifications and marks one as read", async () => {
    const notificationEmail = uniqueEmail("notification-member");
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Notification Member",
      email: notificationEmail,
      password: "Password123",
    });
    expect(registration.status).toBe(201);
    const cookie = registration.headers["set-cookie"];
    const registeredUserId = registration.body.user.id;

    const podsResponse = await request(app).get("/api/pods").set("Cookie", cookie);
    expect(podsResponse.status).toBe(200);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    const notification = await prisma.notification.create({
      data: {
        userId: registeredUserId,
        podId: publicPod.id,
        type: "PHASE_REMINDER",
        title: "Ritual Reminder",
        message: "Submit your check-in today.",
        scheduledAt: new Date(),
        sentAt: new Date(),
      },
    });

    const listResponse = await request(app).get("/api/pods/notifications").set("Cookie", cookie);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.notifications.some((item) => item.id === notification.id)).toBe(true);

    const markReadResponse = await request(app)
      .patch(`/api/pods/notifications/${notification.id}/read`)
      .set("Cookie", cookie);

    expect(markReadResponse.status).toBe(200);

    const updatedNotification = await prisma.notification.findUnique({
      where: { id: notification.id },
      select: { readAt: true },
    });
    expect(updatedNotification.readAt).toBeTruthy();

    const markUnreadResponse = await request(app)
      .patch(`/api/pods/notifications/${notification.id}/unread`)
      .set("Cookie", cookie);

    expect(markUnreadResponse.status).toBe(200);

    const unreadNotification = await prisma.notification.findUnique({
      where: { id: notification.id },
      select: { readAt: true },
    });
    expect(unreadNotification.readAt).toBeNull();
  });

  it("creates nudges, creates a receiver notification, and returns accountability history", async () => {
    const senderEmail = uniqueEmail("nudge-sender");
    const senderRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Nudge Sender",
      email: senderEmail,
      password: "Password123",
    });
    expect(senderRegistration.status).toBe(201);
    const receiverEmail = uniqueEmail("nudge-receiver");
    const receiverRegistration = await request(app).post("/api/auth/register").send({
      fullName: "Nudge Receiver",
      email: receiverEmail,
      password: "Password123",
    });
    expect(receiverRegistration.status).toBe(201);

    const senderCookie = senderRegistration.headers["set-cookie"];
    const receiverCookie = receiverRegistration.headers["set-cookie"];
    const receiverId = receiverRegistration.body.user.id;

    const podsResponse = await request(app).get("/api/pods").set("Cookie", senderCookie);
    expect(podsResponse.status).toBe(200);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    const senderJoin = await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", senderCookie);
    const receiverJoin = await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", receiverCookie);
    expect(senderJoin.status).toBe(200);
    expect(receiverJoin.status).toBe(200);

    const sendNudgeResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/nudges`)
      .set("Cookie", senderCookie)
      .send({
        toUserId: receiverId,
        message: "Checking in on your goals this week.",
        templateId: "goals_week",
      });

    expect(sendNudgeResponse.status).toBe(201);
    expect(sendNudgeResponse.body.nudge.toUserId).toBe(receiverId);
    expect(sendNudgeResponse.body.nudge.fromName).toBe("Nudge Sender");

    const nudgeNotification = await prisma.notification.findFirst({
      where: {
        podId: publicPod.id,
        userId: receiverId,
        type: "NUDGE_RECEIVED",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(nudgeNotification).toBeTruthy();
    expect(nudgeNotification.senderId).toBe(senderRegistration.body.user.id);

    const receiverHistoryResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/accountability`)
      .set("Cookie", receiverCookie);

    expect(receiverHistoryResponse.status).toBe(200);
    expect(receiverHistoryResponse.body.history.received.length).toBeGreaterThan(0);
    expect(receiverHistoryResponse.body.history.received[0].fromName).toBe("Nudge Sender");

    const senderHistoryResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/accountability`)
      .set("Cookie", senderCookie);

    expect(senderHistoryResponse.status).toBe(200);
    expect(senderHistoryResponse.body.history.sent.length).toBeGreaterThan(0);

    const respondResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/nudges/${sendNudgeResponse.body.nudge.id}/respond`)
      .set("Cookie", receiverCookie)
      .send({ quickReplyId: "busy_okay" });

    expect(respondResponse.status).toBe(200);
    expect(respondResponse.body.nudge.quickReplyId).toBe("busy_okay");
    expect(respondResponse.body.nudge.quickReply).toBe("Doing okay, just busy!");

    const senderHistoryAfterReply = await request(app)
      .get(`/api/pods/${publicPod.id}/accountability`)
      .set("Cookie", senderCookie);

    expect(senderHistoryAfterReply.status).toBe(200);
    const repliedSentNudge = senderHistoryAfterReply.body.history.sent.find(
      (item) => item.id === sendNudgeResponse.body.nudge.id,
    );
    expect(repliedSentNudge).toBeTruthy();
    expect(repliedSentNudge.respondedAt).toBeTruthy();
    expect(repliedSentNudge.quickReplyId).toBe("busy_okay");

    const senderNotificationsResponse = await request(app)
      .get("/api/pods/notifications")
      .set("Cookie", senderCookie);

    expect(senderNotificationsResponse.status).toBe(200);
    const replyNotification = senderNotificationsResponse.body.notifications.find(
      (item) => item.type === "NUDGE_REPLIED" && item.sender?.id === receiverId,
    );
    expect(replyNotification).toBeTruthy();

    const receiverNotificationsResponse = await request(app)
      .get("/api/pods/notifications")
      .set("Cookie", receiverCookie);

    expect(receiverNotificationsResponse.status).toBe(200);
    const receiverHasReplyNotification = receiverNotificationsResponse.body.notifications.some(
      (item) => item.type === "NUDGE_REPLIED",
    );
    expect(receiverHasReplyNotification).toBe(false);
  }, 15000);

  it("updates pod quiet mode through accountability endpoint", async () => {
    const quietEmail = uniqueEmail("quiet-mode-user");
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Quiet Mode User",
      email: quietEmail,
      password: "Password123",
    });
    expect(registration.status).toBe(201);
    const cookie = registration.headers["set-cookie"];

    const podsResponse = await request(app).get("/api/pods").set("Cookie", cookie);
    expect(podsResponse.status).toBe(200);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    const joinResponse = await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", cookie);
    expect(joinResponse.status).toBe(200);

    const enableResponse = await request(app)
      .put(`/api/pods/${publicPod.id}/accountability/quiet-mode`)
      .set("Cookie", cookie)
      .send({
        enabled: true,
        until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        announcedToPod: false,
      });

    expect(enableResponse.status).toBe(200);
    expect(enableResponse.body.quietMode.enabled).toBe(true);
    expect(enableResponse.body.quietMode.announcedToPod).toBe(false);

    const accountabilityResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/accountability`)
      .set("Cookie", cookie);

    expect(accountabilityResponse.status).toBe(200);
    expect(accountabilityResponse.body.quietMode.enabled).toBe(true);

    const disableResponse = await request(app)
      .put(`/api/pods/${publicPod.id}/accountability/quiet-mode`)
      .set("Cookie", cookie)
      .send({ enabled: false, until: null, announcedToPod: true });

    expect(disableResponse.status).toBe(200);
    expect(disableResponse.body.quietMode.enabled).toBe(false);
  });

  it("returns detailed pod payload for a valid pod id", async () => {
    const podDetailEmail = uniqueEmail("pod-detail-member");
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Pod Detail Member",
      email: podDetailEmail,
      password: "Password123",
    });
    expect(registration.status).toBe(201);
    const cookie = registration.headers["set-cookie"];

    const podsResponse = await request(app).get("/api/pods").set("Cookie", cookie);
    expect(podsResponse.status).toBe(200);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    const detailResponse = await request(app).get(`/api/pods/${publicPod.id}`).set("Cookie", cookie);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.pod.id).toBe(publicPod.id);
    expect(detailResponse.body.pod).toHaveProperty("memberCount");
  });

  it("lists content-backed biweekly periods and enforces no generation for expired windows", async () => {
    const summaryMemberEmail = uniqueEmail("summary-member");
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Summary Member",
      email: summaryMemberEmail,
      password: "Password123",
    });
    expect(registration.status).toBe(201);
    const cookie = registration.headers["set-cookie"];

    const podsResponse = await request(app).get("/api/pods").set("Cookie", cookie);
    expect(podsResponse.status).toBe(200);
    const publicPod = podsResponse.body.pods.find((pod) => pod.visibility === "PUBLIC");

    await prisma.pod.update({
      where: { id: publicPod.id },
      data: {
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      },
    });

    const joinResponse = await request(app).post(`/api/pods/${publicPod.id}/join`).set("Cookie", cookie);
    expect(joinResponse.status).toBe(200);

    const postResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/posts`)
      .set("Cookie", cookie)
      .send({ content: "Current period progress update for AI summary." });
    
    expect(postResponse.status).toBe(201);

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 20);

    await prisma.podPost.create({
      data: {
        podId: publicPod.id,
        authorId: registration.body.user.id,
        content: "Old period content to create an expired summary period.",
        createdAt: oldDate,
      },
    });

    const periodsResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/biweekly-summaries/periods`)
      .set("Cookie", cookie);

    expect(periodsResponse.status).toBe(200);
    expect(Array.isArray(periodsResponse.body.periods)).toBe(true);
    expect(periodsResponse.body.periods.length).toBeGreaterThanOrEqual(2);

    const activePeriod = periodsResponse.body.periods.find((period) => period.isActive);
    const expiredPeriod = periodsResponse.body.periods.find((period) => period.isExpired);

    expect(activePeriod).toBeTruthy();
    expect(expiredPeriod).toBeTruthy();

    const blockedExpiredGenerateResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/biweekly-summaries/generate`)
      .set("Cookie", cookie)
      .send({ windowStartAt: expiredPeriod.windowStartAt });

    expect(blockedExpiredGenerateResponse.status).toBe(409);

    const generatedActiveResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/biweekly-summaries/generate`)
      .set("Cookie", cookie)
      .send({ windowStartAt: activePeriod.windowStartAt });

    expect(generatedActiveResponse.status).toBe(201);
    expect(generatedActiveResponse.body.generated).toBe(true);
    expect(generatedActiveResponse.body.summary.summaryText.length).toBeGreaterThan(10);

    const fetchSummaryResponse = await request(app)
      .get(`/api/pods/${publicPod.id}/biweekly-summaries`)
      .set("Cookie", cookie)
      .query({ windowStartAt: activePeriod.windowStartAt });

    expect(fetchSummaryResponse.status).toBe(200);
    expect(fetchSummaryResponse.body.summary.windowStartAt).toBe(activePeriod.windowStartAt);

    const regeneratedResponse = await request(app)
      .post(`/api/pods/${publicPod.id}/biweekly-summaries/generate`)
      .set("Cookie", cookie)
      .send({ windowStartAt: activePeriod.windowStartAt });

    expect(regeneratedResponse.status).toBe(201);
    expect(regeneratedResponse.body.generated).toBe(true);
  }, 15000);

  it("rejects generation for windows before pod creation period", async () => {
    const summaryCreatorEmail = uniqueEmail("summary-creator");
    const registration = await request(app).post("/api/auth/register").send({
      fullName: "Summary Creator",
      email: summaryCreatorEmail,
      password: "Password123",
    });
    expect(registration.status).toBe(201);
    const cookie = registration.headers["set-cookie"];

    const createdPodResponse = await request(app)
      .post("/api/pods")
      .set("Cookie", cookie)
      .send({
        name: "Summary Guardrail Pod",
        description: "Pod to verify summary period guardrails for generation requests.",
        focusArea: "Career",
        visibility: "PUBLIC",
      });

    expect(createdPodResponse.status).toBe(201);
    const createdAt = new Date(createdPodResponse.body.pod.createdAt);
    const podStart = getBiWeeklyStartDate(createdAt);
    const invalidStart = new Date(podStart);
    invalidStart.setDate(invalidStart.getDate() - 14);

    const responseBeforeCreation = await request(app)
      .post(`/api/pods/${createdPodResponse.body.pod.id}/biweekly-summaries/generate`)
      .set("Cookie", cookie)
      .send({ windowStartAt: invalidStart.toISOString() });

    expect(responseBeforeCreation.status).toBe(400);
  });
});

describe("Accountability Data Models", () => {
  async function createBaseEntities() {
    const suffix = uniqueSuffix();
    const fromUser = await prisma.user.create({
      data: {
        email: `nudge-from-${suffix}@example.com`,
        authProvider: "LOCAL",
      },
    });

    const toUser = await prisma.user.create({
      data: {
        email: `nudge-to-${suffix}@example.com`,
        authProvider: "LOCAL",
      },
    });

    const pod = await prisma.pod.create({
      data: {
        slug: `nudge-test-pod-${suffix}`,
        name: "Nudge Test Pod",
        description: "Pod used for accountability data model tests.",
        focusArea: "Accountability",
        visibility: "PRIVATE",
        isDefault: false,
      },
    });

    return { fromUser, toUser, pod };
  }

  it("creates a nudge with defaults and optional fields", async () => {
    const { fromUser, toUser, pod } = await createBaseEntities();

    const created = await prisma.nudge.create({
      data: {
        podId: pod.id,
        fromUserId: fromUser.id,
        toUserId: toUser.id,
        nudgeType: "CUSTOM",
        message: "Quick check-in: how are applications going?",
      },
    });

    expect(created.flaggedForReview).toBe(false);
    expect(created.response).toBeNull();
    expect(created.readAt).toBeNull();
    expect(created.message).toContain("check-in");
  });

  it("enforces one quiet mode record per user and pod", async () => {
    const { fromUser, pod } = await createBaseEntities();

    const first = await prisma.quietMode.create({
      data: {
        userId: fromUser.id,
        podId: pod.id,
        startDate: new Date("2026-04-07T00:00:00.000Z"),
        reason: "Exam week",
      },
    });

    expect(first.autoNotify).toBe(true);

    await expect(
      prisma.quietMode.create({
        data: {
          userId: fromUser.id,
          podId: pod.id,
          startDate: new Date("2026-04-08T00:00:00.000Z"),
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("enforces weekly uniqueness for accountability metrics", async () => {
    const { fromUser, pod } = await createBaseEntities();
    const weekStartDate = new Date("2026-04-06T00:00:00.000Z");

    const metric = await prisma.accountabilityMetric.create({
      data: {
        userId: fromUser.id,
        podId: pod.id,
        weekStartDate,
        nudgesReceived: 3,
        nudgesSent: 2,
        responseRate: 0.67,
      },
    });

    expect(metric.nudgesReceived).toBe(3);
    expect(metric.nudgesSent).toBe(2);

    await expect(
      prisma.accountabilityMetric.create({
        data: {
          userId: fromUser.id,
          podId: pod.id,
          weekStartDate,
          nudgesReceived: 1,
          nudgesSent: 1,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
