import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";
import { getSupabaseClient } from "../lib/supabase.js";
import { toPublicUser } from "../utils/users.js";
import { getCurrentPhase, getPromptForPhase } from "../services/phaseService.js";

const router = Router();


function getBiWeeklyStartDate(date) {
  const d = new Date(date);
  const daysSinceEpoch = Math.floor(d.getTime() / (1000 * 60 * 60 * 24));
  const biWeeklyOffset = daysSinceEpoch % 14;
  d.setDate(d.getDate() - biWeeklyOffset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isBiWeeklyActive(currentDate, weekStartDate) {
  const daysSinceStart = Math.floor((currentDate - weekStartDate) / (1000 * 60 * 60 * 24));
  return daysSinceStart < 14;
}

const podCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(500),
  focusArea: z.string().trim().min(2).max(120),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
});

const membershipDecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

const podPostCreateSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

const resumeReviewCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  targetRole: z.string().trim().max(120).optional().or(z.literal("")),
  context: z.string().trim().max(4000).optional().or(z.literal("")),
});

const resumeFileUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(["application/pdf"]),
  contentBase64: z.string().min(1),
});

const resumeFeedbackSchema = z.object({
  overallScore: z.number().int().min(1).max(5).optional(),
  impactAndResultsScore: z.number().int().min(1).max(5).optional(),
  roleFitScore: z.number().int().min(1).max(5).optional(),
  atsClarityScore: z.number().int().min(1).max(5).optional(),
  strengths: z.string().trim().min(1).max(4000),
  improvements: z.string().trim().min(1).max(4000),
  lineLevelSuggestions: z.string().trim().max(6000).optional().or(z.literal("")),
  finalComments: z.string().trim().max(4000).optional().or(z.literal("")),
  recommendation: z.enum(["STRONG_YES", "YES_WITH_EDITS", "NEEDS_MAJOR_REVISION"]).optional(),
});

const resumeStatusUpdateSchema = z.object({
  status: z.enum(["CLOSED", "WITHDRAWN"]),
});

function toPodResponse(pod) {
  const membership = pod.memberships?.[0] || null;

  return {
    id: pod.id,
    slug: pod.slug,
    name: pod.name,
    description: pod.description,
    focusArea: pod.focusArea,
    visibility: pod.visibility,
    joinActionLabel: pod.visibility === "PRIVATE" ? "Request To Join" : "Join Group",
    isDefault: pod.isDefault,
    createdById: pod.createdById,
    createdAt: pod.createdAt,
    updatedAt: pod.updatedAt,
    memberCount: pod._count?.memberships || 0,
    membershipStatus: membership?.status || null,
    membershipRole: membership?.role || null,
  };
}

function toMembershipResponse(membership) {
  return {
    id: membership.id,
    podId: membership.podId,
    userId: membership.userId,
    role: membership.role,
    status: membership.status,
    requestedAt: membership.requestedAt,
    joinedAt: membership.joinedAt,
    reviewedAt: membership.reviewedAt,
    reviewedById: membership.reviewedById,
  };
}

function toPodPostResponse(post) {
  return {
    id: post.id,
    podId: post.podId,
    authorId: post.authorId,
    content: post.content,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: toPublicUser(post.author),
  };
}

function slugify(input) {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return normalized || "group";
}

async function generateUniquePodSlug(name) {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const existing = await prisma.pod.findUnique({ where: { slug: candidate } });
    if (!existing) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function getPodWithAccess(podId, userId) {
  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: {
      id: true,
      createdById: true,
      memberships: {
        where: {
          userId,
          status: "ACTIVE",
          role: "ADMIN",
        },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!pod) {
    return { exists: false, canManage: false };
  }

  const isCreator = pod.createdById === userId;
  const isMembershipAdmin = pod.memberships.length > 0;

  return {
    exists: true,
    canManage: isCreator || isMembershipAdmin,
  };
}

async function getActiveMembership(podId, userId) {
  return prisma.podMembership.findUnique({
    where: {
      podId_userId: {
        podId,
        userId,
      },
    },
    select: {
      id: true,
      status: true,
      role: true,
    },
  });
}

async function getPodAccessContext(podId, userId) {
  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: {
      id: true,
      createdById: true,
      memberships: {
        where: {
          userId,
          status: "ACTIVE",
        },
        select: { id: true, role: true, status: true },
        take: 1,
      },
    },
  });

  if (!pod) {
    return { exists: false, isActiveMember: false, isAdmin: false };
  }

  const activeMembership = pod.memberships[0] || null;
  const isActiveMember = Boolean(activeMembership);
  const isAdmin = pod.createdById === userId || activeMembership?.role === "ADMIN";

  return {
    exists: true,
    isActiveMember,
    isAdmin,
  };
}

async function getResumeRequestWithAccess(requestId, podId, userId) {
  const request = await prisma.podResumeReviewRequest.findUnique({
    where: { id: requestId },
    include: {
      pod: true,
      requester: true,
      file: true,
      feedback: {
        include: {
          reviewer: true,
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!request || request.podId !== podId) {
    return { exists: false, request: null, canView: false, canAdmin: false, isRequester: false };
  }

  const access = await getPodAccessContext(podId, userId);
  const isRequester = request.requesterId === userId;

  return {
    exists: true,
    request,
    canView: access.isActiveMember,
    canAdmin: access.isAdmin,
    isRequester,
  };
}

function toResumeReviewRequestResponse(reviewRequest, options = {}) {
  const { includeFeedback = false, redactFeedback = false } = options;

  return {
    id: reviewRequest.id,
    podId: reviewRequest.podId,
    requesterId: reviewRequest.requesterId,
    status: reviewRequest.status,
    title: reviewRequest.title,
    targetRole: reviewRequest.targetRole,
    context: reviewRequest.context,
    closedAt: reviewRequest.closedAt,
    createdAt: reviewRequest.createdAt,
    updatedAt: reviewRequest.updatedAt,
    requester: toPublicUser(reviewRequest.requester),
    file: reviewRequest.file
      ? {
          id: reviewRequest.file.id,
          originalFileName: reviewRequest.file.originalFileName,
          mimeType: reviewRequest.file.mimeType,
          sizeBytes: reviewRequest.file.sizeBytes,
          uploadedAt: reviewRequest.file.uploadedAt,
        }
      : null,
    feedback: includeFeedback
      ? reviewRequest.feedback.map((feedbackItem) => ({
          id: feedbackItem.id,
          requestId: feedbackItem.requestId,
          reviewerId: feedbackItem.reviewerId,
          overallScore: feedbackItem.overallScore,
          impactAndResultsScore: feedbackItem.impactAndResultsScore,
          roleFitScore: feedbackItem.roleFitScore,
          atsClarityScore: feedbackItem.atsClarityScore,
          strengths: feedbackItem.strengths,
          improvements: feedbackItem.improvements,
          lineLevelSuggestions: feedbackItem.lineLevelSuggestions,
          finalComments: feedbackItem.finalComments,
          recommendation: feedbackItem.recommendation,
          submittedAt: feedbackItem.submittedAt,
          updatedAt: feedbackItem.updatedAt,
          reviewer: toPublicUser(feedbackItem.reviewer),
        }))
      : redactFeedback
        ? []
        : undefined,
  };
}

function toResumeFeedbackResponse(feedback, includeReviewer = false) {
  return {
    id: feedback.id,
    requestId: feedback.requestId,
    reviewerId: feedback.reviewerId,
    overallScore: feedback.overallScore,
    impactAndResultsScore: feedback.impactAndResultsScore,
    roleFitScore: feedback.roleFitScore,
    atsClarityScore: feedback.atsClarityScore,
    strengths: feedback.strengths,
    improvements: feedback.improvements,
    lineLevelSuggestions: feedback.lineLevelSuggestions,
    finalComments: feedback.finalComments,
    recommendation: feedback.recommendation,
    submittedAt: feedback.submittedAt,
    updatedAt: feedback.updatedAt,
    reviewer: includeReviewer ? toPublicUser(feedback.reviewer) : undefined,
  };
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
}

function decodeBase64Pdf(contentBase64) {
  const normalized = contentBase64.includes(",") ? contentBase64.split(",").pop() : contentBase64;
  return Buffer.from(normalized, "base64");
}

router.get("/", requireAuth, async (request, response) => {
  try {
    const pods = await prisma.pod.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: {
        memberships: {
          where: { userId: request.user.id },
          select: {
            role: true,
            status: true,
          },
          take: 1,
        },
        _count: {
          select: {
            memberships: {
              where: { status: "ACTIVE" },
            },
          },
        },
      },
    });

    return response.status(200).json({ pods: pods.map(toPodResponse) });
  } catch {
    return response.status(500).json({ message: "Failed to load pods." });
  }
});

router.post("/", requireAuth, async (request, response) => {
  try {
    const data = podCreateSchema.parse(request.body);
    const slug = await generateUniquePodSlug(data.name);

    const pod = await prisma.$transaction(async (transaction) => {
      const createdPod = await transaction.pod.create({
        data: {
          slug,
          name: data.name,
          description: data.description,
          focusArea: data.focusArea,
          visibility: data.visibility || "PUBLIC",
          isDefault: false,
          createdById: request.user.id,
        },
      });

      await transaction.podMembership.create({
        data: {
          podId: createdPod.id,
          userId: request.user.id,
          role: "ADMIN",
          status: "ACTIVE",
          requestedAt: new Date(),
          joinedAt: new Date(),
        },
      });

      return createdPod;
    });

    const hydratedPod = await prisma.pod.findUnique({
      where: { id: pod.id },
      include: {
        memberships: {
          where: { userId: request.user.id },
          select: { role: true, status: true },
          take: 1,
        },
        _count: {
          select: {
            memberships: {
              where: { status: "ACTIVE" },
            },
          },
        },
      },
    });

    return response.status(201).json({ pod: toPodResponse(hydratedPod) });
  } catch (error) {
    if (error?.name === "ZodError") {
      return response.status(400).json({ message: "Invalid pod data.", issues: error.issues });
    }

    return response.status(500).json({ message: "Failed to create pod." });
  }
});

//USER STORY 3: Pod Onboarding Routes

router.get("/:podId/onboarding", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;

    const membership = await prisma.podMembership.findUnique({
      where: {
        podId_userId: {
          podId,
          userId: request.user.id,
        },
      },
      select: {
        onboardedAt: true,
        introMessage: true,
        role: true,
        status: true,
      },
    });

    if (!membership) {
      return response.status(404).json({ message: "Not a member of this pod." });
    }

    return response.status(200).json({
      onboarded: Boolean(membership.onboardedAt),
      introMessage: membership.introMessage,
      canOnboard: membership.status === "ACTIVE" && !membership.onboardedAt,
    });
  } catch (error) {
    return response.status(500).json({ message: "Failed to get onboarding status." });
  }
});

router.post("/:podId/onboarding", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const { introMessage } = request.body;

    if (!introMessage?.trim()) {
      return response.status(400).json({ message: "Introduction message is required." });
    }

    const membership = await prisma.podMembership.findUnique({
      where: {
        podId_userId: {
          podId,
          userId: request.user.id,
        },
      },
    });

    if (!membership || membership.status !== "ACTIVE") {
      return response.status(403).json({ message: "Must be an active member to onboard." });
    }

    if (membership.onboardedAt) {
      return response.status(400).json({ message: "Already onboarded." });
    }

    const trimmedIntroMessage = introMessage.trim();
    const userLabel = request.user.fullName?.trim() || request.user.email;
    const onboardingFeedMessage = `${userLabel} joined the pod. Intro: ${trimmedIntroMessage}`;

    const updated = await prisma.$transaction(async (transaction) => {
      const updatedMembership = await transaction.podMembership.update({
        where: { id: membership.id },
        data: {
          onboardedAt: new Date(),
          introMessage: trimmedIntroMessage,
        },
      });

      await transaction.podPost.create({
        data: {
          podId,
          authorId: request.user.id,
          content: onboardingFeedMessage,
        },
      });

      return updatedMembership;
    });

    return response.status(200).json({
      message: "Onboarding completed.",
      onboardedAt: updated.onboardedAt,
    });
  } catch (error) {
    return response.status(500).json({ message: "Failed to complete onboarding." });
  }
});

//USER STORY 4: Pod Members Routes

router.get("/:podId/members", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;

    const membership = await prisma.podMembership.findUnique({
      where: {
        podId_userId: {
          podId,
          userId: request.user.id,
        },
      },
    });

    if (!membership || membership.status !== "ACTIVE") {
      return response.status(403).json({ message: "Must be an active member to view members." });
    }

    const members = await prisma.podMembership.findMany({
      where: {
        podId,
        status: "ACTIVE",
      },
      include: {
        user: true,
      },
      orderBy: [
        { role: "desc" },
        { joinedAt: "asc" },
      ],
    });

    return response.status(200).json({
      members: members.map(m => ({
        ...toPublicUser(m.user),
        role: m.role,
        joinedAt: m.joinedAt,
        onboardedAt: m.onboardedAt,
        introMessage: m.introMessage,
      })),
    });
  } catch (error) {
    return response.status(500).json({ message: "Failed to load members." });
  }
});

router.get("/user/mypods", requireAuth, async (request, response) => {
  try {
    const memberships = await prisma.podMembership.findMany({
      where: {
        userId: request.user.id,
        status: "ACTIVE",
      },
      include: {
        pod: {
          include: {
            _count: {
              select: {
                memberships: {
                  where: { status: "ACTIVE" },
                },
              },
            },
          },
        },
      },
      orderBy: [{ joinedAt: "desc" }],
    });

    return response.status(200).json({
      pods: memberships.map(m => ({
        id: m.pod.id,
        slug: m.pod.slug,
        name: m.pod.name,
        description: m.pod.description,
        focusArea: m.pod.focusArea,
        visibility: m.pod.visibility,
        memberCount: m.pod._count.memberships,
        joinedAt: m.joinedAt,
        role: m.role,
        onboarded: Boolean(m.onboardedAt),
      })),
    });
  } catch (error) {
    return response.status(500).json({ message: "Failed to load your pods." });
  }
});

router.post("/:podId/join", requireAuth, async (request, response) => {
  try {
    const podId = request.params.podId;

    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      select: {
        id: true,
        visibility: true,
      },
    });

    if (!pod) {
      return response.status(404).json({ message: "Pod not found." });
    }

    const existingMembership = await prisma.podMembership.findUnique({
      where: {
        podId_userId: {
          podId,
          userId: request.user.id,
        },
      },
    });

    if (pod.visibility === "PUBLIC") {
      if (existingMembership?.status === "ACTIVE") {
        return response.status(200).json({
          message: "Already joined.",
          membership: toMembershipResponse(existingMembership),
        });
      }

      const membership = existingMembership
        ? await prisma.podMembership.update({
            where: { id: existingMembership.id },
            data: {
              status: "ACTIVE",
              joinedAt: existingMembership.joinedAt || new Date(),
              reviewedAt: new Date(),
              reviewedById: request.user.id,
            },
          })
        : await prisma.podMembership.create({
            data: {
              podId,
              userId: request.user.id,
              role: "MEMBER",
              status: "ACTIVE",
              requestedAt: new Date(),
              joinedAt: new Date(),
            },
          });

      return response.status(200).json({
        message: "Joined group.",
        membership: toMembershipResponse(membership),
      });
    }

    if (existingMembership?.status === "ACTIVE") {
      return response.status(200).json({
        message: "Already joined.",
        membership: toMembershipResponse(existingMembership),
      });
    }

    if (existingMembership?.status === "PENDING") {
      return response.status(200).json({
        message: "Join request already submitted.",
        membership: toMembershipResponse(existingMembership),
      });
    }

    const pendingMembership = existingMembership
      ? await prisma.podMembership.update({
          where: { id: existingMembership.id },
          data: {
            status: "PENDING",
            requestedAt: new Date(),
            joinedAt: null,
            reviewedAt: null,
            reviewedById: null,
          },
        })
      : await prisma.podMembership.create({
          data: {
            podId,
            userId: request.user.id,
            role: "MEMBER",
            status: "PENDING",
            requestedAt: new Date(),
          },
        });

    return response.status(202).json({
      message: "Join request submitted.",
      membership: toMembershipResponse(pendingMembership),
    });
  } catch {
    return response.status(500).json({ message: "Failed to join pod." });
  }
});

router.post("/:podId/leave", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;

    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      select: { id: true },
    });

    if (!pod) {
      return response.status(404).json({ message: "Pod not found." });
    }

    const membership = await prisma.podMembership.findUnique({
      where: {
        podId_userId: {
          podId,
          userId: request.user.id,
        },
      },
    });

    if (!membership || (membership.status !== "ACTIVE" && membership.status !== "PENDING")) {
      return response.status(400).json({ message: "You are not currently in this group." });
    }

    await prisma.podMembership.delete({ where: { id: membership.id } });

    return response.status(200).json({
      message: membership.status === "PENDING" ? "Join request cancelled." : "Left group.",
    });
  } catch {
    return response.status(500).json({ message: "Failed to leave pod." });
  }
});

router.get("/:podId/posts", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;

    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      select: { id: true },
    });

    if (!pod) {
      return response.status(404).json({ message: "Pod not found." });
    }

    const posts = await prisma.podPost.findMany({
      where: { podId },
      orderBy: [{ createdAt: "desc" }],
      include: {
        author: true,
      },
    });

    return response.status(200).json({ posts: posts.map(toPodPostResponse) });
  } catch {
    return response.status(500).json({ message: "Failed to load posts." });
  }
});

router.post("/:podId/posts", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const data = podPostCreateSchema.parse(request.body);

    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      select: { id: true },
    });

    if (!pod) {
      return response.status(404).json({ message: "Pod not found." });
    }

    const membership = await getActiveMembership(podId, request.user.id);

    if (!membership || membership.status !== "ACTIVE") {
      return response.status(403).json({ message: "You must be an active member to post." });
    }

    const post = await prisma.podPost.create({
      data: {
        podId,
        authorId: request.user.id,
        content: data.content,
      },
      include: {
        author: true,
      },
    });

    return response.status(201).json({ post: toPodPostResponse(post) });
  } catch (error) {
    if (error?.name === "ZodError") {
      return response.status(400).json({ message: "Invalid post payload.", issues: error.issues });
    }

    return response.status(500).json({ message: "Failed to create post." });
  }
});

router.delete("/:podId/posts/:postId", requireAuth, async (request, response) => {
  try {
    const { podId, postId } = request.params;

    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      select: { id: true },
    });

    if (!pod) {
      return response.status(404).json({ message: "Pod not found." });
    }

    const membership = await getActiveMembership(podId, request.user.id);
    if (!membership || membership.status !== "ACTIVE") {
      return response.status(403).json({ message: "You must be an active member to manage posts." });
    }

    const post = await prisma.podPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        podId: true,
        authorId: true,
      },
    });

    if (!post || post.podId !== podId) {
      return response.status(404).json({ message: "Post not found." });
    }

    if (post.authorId !== request.user.id) {
      return response.status(403).json({ message: "You can only delete your own posts." });
    }

    await prisma.podPost.delete({ where: { id: post.id } });

    return response.status(200).json({ message: "Post deleted." });
  } catch {
    return response.status(500).json({ message: "Failed to delete post." });
  }
});

router.get("/:podId/requests", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const access = await getPodWithAccess(podId, request.user.id);

    if (!access.exists) {
      return response.status(404).json({ message: "Pod not found." });
    }

    if (!access.canManage) {
      return response.status(403).json({ message: "Admin access required." });
    }

    const requests = await prisma.podMembership.findMany({
      where: {
        podId,
        status: "PENDING",
      },
      orderBy: [{ requestedAt: "asc" }],
      include: {
        user: true,
      },
    });

    return response.status(200).json({
      requests: requests.map((requestItem) => ({
        ...toMembershipResponse(requestItem),
        user: toPublicUser(requestItem.user),
      })),
    });
  } catch {
    return response.status(500).json({ message: "Failed to load pending requests." });
  }
});

router.patch("/:podId/requests/:membershipId", requireAuth, async (request, response) => {
  try {
    const { podId, membershipId } = request.params;
    const decision = membershipDecisionSchema.parse(request.body);

    const access = await getPodWithAccess(podId, request.user.id);

    if (!access.exists) {
      return response.status(404).json({ message: "Pod not found." });
    }

    if (!access.canManage) {
      return response.status(403).json({ message: "Admin access required." });
    }

    const pendingMembership = await prisma.podMembership.findFirst({
      where: {
        id: membershipId,
        podId,
        status: "PENDING",
      },
    });

    if (!pendingMembership) {
      return response.status(404).json({ message: "Pending request not found." });
    }

    const membership = await prisma.podMembership.update({
      where: { id: membershipId },
      data:
        decision.action === "approve"
          ? {
              status: "ACTIVE",
              joinedAt: new Date(),
              reviewedAt: new Date(),
              reviewedById: request.user.id,
            }
          : {
              status: "REJECTED",
              reviewedAt: new Date(),
              reviewedById: request.user.id,
            },
    });

    return response.status(200).json({
      message: decision.action === "approve" ? "Member approved." : "Join request rejected.",
      membership: toMembershipResponse(membership),
    });
  } catch (error) {
    if (error?.name === "ZodError") {
      return response.status(400).json({ message: "Invalid decision payload.", issues: error.issues });
    }

    return response.status(500).json({ message: "Failed to process membership request." });
  }
});

router.post("/:podId/resume-reviews", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const access = await getPodAccessContext(podId, request.user.id);

    if (!access.exists) {
      return response.status(404).json({ message: "Pod not found." });
    }

    if (!access.isActiveMember) {
      return response.status(403).json({ message: "You must be an active member to create a resume review." });
    }

    const payload = resumeReviewCreateSchema.parse(request.body);

    const reviewRequest = await prisma.podResumeReviewRequest.create({
      data: {
        podId,
        requesterId: request.user.id,
        title: payload.title,
        targetRole: payload.targetRole || null,
        context: payload.context || null,
      },
      include: {
        requester: true,
        file: true,
        feedback: { include: { reviewer: true } },
      },
    });

    return response.status(201).json({ reviewRequest: toResumeReviewRequestResponse(reviewRequest) });
  } catch (error) {
    if (error?.name === "ZodError") {
      return response.status(400).json({ message: "Invalid resume review payload.", issues: error.issues });
    }

    return response.status(500).json({ message: "Failed to create resume review request." });
  }
});

router.post("/:podId/resume-reviews/:requestId/file", requireAuth, async (request, response) => {
  try {
    const { podId, requestId } = request.params;
    const access = await getResumeRequestWithAccess(requestId, podId, request.user.id);

    if (!access.exists) {
      return response.status(404).json({ message: "Resume review request not found." });
    }

    if (!access.isRequester) {
      return response.status(403).json({ message: "Only the requester can upload the resume file." });
    }

    const payload = resumeFileUploadSchema.parse(request.body);
    const fileBuffer = decodeBase64Pdf(payload.contentBase64);

    if (fileBuffer.length === 0) {
      return response.status(400).json({ message: "Resume file is empty." });
    }

    const maxFileSizeBytes = 10 * 1024 * 1024;
    if (fileBuffer.length > maxFileSizeBytes) {
      return response.status(400).json({ message: "Resume file must be 10MB or smaller." });
    }

    const supabase = getSupabaseClient();
    const fileName = sanitizeFileName(payload.fileName || "resume.pdf");
    const storageBucket = config.supabaseStorageBucket;
    const storagePath = `${podId}/${requestId}/${request.user.id}/${Date.now()}-${fileName}`;

    const uploadResult = await supabase.storage.from(storageBucket).upload(storagePath, fileBuffer, {
      contentType: payload.mimeType,
      upsert: true,
    });

    if (uploadResult.error) {
      return response.status(500).json({ message: uploadResult.error.message || "Failed to upload resume file." });
    }

    const fileRecord = await prisma.podResumeFile.upsert({
      where: { requestId },
      update: {
        uploadedById: request.user.id,
        storageBucket,
        storagePath,
        originalFileName: payload.fileName,
        mimeType: payload.mimeType,
        sizeBytes: fileBuffer.length,
      },
      create: {
        requestId,
        uploadedById: request.user.id,
        storageBucket,
        storagePath,
        originalFileName: payload.fileName,
        mimeType: payload.mimeType,
        sizeBytes: fileBuffer.length,
      },
    });

    return response.status(200).json({
      file: {
        id: fileRecord.id,
        requestId: fileRecord.requestId,
        storageBucket: fileRecord.storageBucket,
        storagePath: fileRecord.storagePath,
        originalFileName: fileRecord.originalFileName,
        mimeType: fileRecord.mimeType,
        sizeBytes: fileRecord.sizeBytes,
        uploadedAt: fileRecord.uploadedAt,
      },
    });
  } catch (error) {
    if (error?.name === "ZodError") {
      return response.status(400).json({ message: "Invalid resume file payload.", issues: error.issues });
    }

    return response.status(500).json({ message: "Failed to upload resume file." });
  }
});

router.get("/:podId/resume-reviews", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const access = await getPodAccessContext(podId, request.user.id);

    if (!access.exists) {
      return response.status(404).json({ message: "Pod not found." });
    }

    if (!access.isActiveMember) {
      return response.status(403).json({ message: "Active membership required." });
    }

    const reviewRequests = await prisma.podResumeReviewRequest.findMany({
      where: { podId },
      include: {
        requester: true,
        file: true,
        feedback: {
          include: { reviewer: true },
          orderBy: { submittedAt: "desc" },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return response.status(200).json({
      reviewRequests: reviewRequests.map((reviewRequest) =>
        toResumeReviewRequestResponse(reviewRequest, {
          redactFeedback: !access.isAdmin && reviewRequest.requesterId !== request.user.id,
        }),
      ),
    });
  } catch (error) {
    return response.status(500).json({ message: "Failed to load resume review requests." });
  }
});

router.get("/:podId/resume-reviews/:requestId", requireAuth, async (request, response) => {
  try {
    const { podId, requestId } = request.params;
    const access = await getResumeRequestWithAccess(requestId, podId, request.user.id);

    if (!access.exists) {
      return response.status(404).json({ message: "Resume review request not found." });
    }

    if (!access.canView) {
      return response.status(403).json({ message: "Active membership required." });
    }

    return response.status(200).json({
      reviewRequest: toResumeReviewRequestResponse(access.request, {
        includeFeedback: access.isRequester || access.canAdmin,
        redactFeedback: !access.isRequester && !access.canAdmin,
      }),
    });
  } catch (error) {
    return response.status(500).json({ message: "Failed to load resume review request." });
  }
});

router.post("/:podId/resume-reviews/:requestId/feedback", requireAuth, async (request, response) => {
  try {
    const { podId, requestId } = request.params;
    const access = await getResumeRequestWithAccess(requestId, podId, request.user.id);

    if (!access.exists) {
      return response.status(404).json({ message: "Resume review request not found." });
    }

    if (!access.canView) {
      return response.status(403).json({ message: "Active membership required." });
    }

    if (access.request.requesterId === request.user.id) {
      return response.status(403).json({ message: "You cannot review your own resume." });
    }

    const membership = await getActiveMembership(podId, request.user.id);
    if (!membership || membership.status !== "ACTIVE") {
      return response.status(403).json({ message: "Active membership required." });
    }

    const payload = resumeFeedbackSchema.parse(request.body);

    const feedback = await prisma.podResumeReviewFeedback.upsert({
      where: {
        requestId_reviewerId: {
          requestId,
          reviewerId: request.user.id,
        },
      },
      update: {
        overallScore: payload.overallScore ?? null,
        impactAndResultsScore: payload.impactAndResultsScore ?? null,
        roleFitScore: payload.roleFitScore ?? null,
        atsClarityScore: payload.atsClarityScore ?? null,
        strengths: payload.strengths.trim(),
        improvements: payload.improvements.trim(),
        lineLevelSuggestions: payload.lineLevelSuggestions?.trim() || null,
        finalComments: payload.finalComments?.trim() || null,
        recommendation: payload.recommendation || null,
      },
      create: {
        requestId,
        reviewerId: request.user.id,
        overallScore: payload.overallScore ?? null,
        impactAndResultsScore: payload.impactAndResultsScore ?? null,
        roleFitScore: payload.roleFitScore ?? null,
        atsClarityScore: payload.atsClarityScore ?? null,
        strengths: payload.strengths.trim(),
        improvements: payload.improvements.trim(),
        lineLevelSuggestions: payload.lineLevelSuggestions?.trim() || null,
        finalComments: payload.finalComments?.trim() || null,
        recommendation: payload.recommendation || null,
      },
      include: { reviewer: true },
    });

    return response.status(200).json({ feedback: toResumeFeedbackResponse(feedback, true) });
  } catch (error) {
    if (error?.name === "ZodError") {
      return response.status(400).json({ message: "Invalid feedback payload.", issues: error.issues });
    }

    return response.status(500).json({ message: "Failed to submit feedback." });
  }
});

router.get("/:podId/resume-reviews/:requestId/feedback", requireAuth, async (request, response) => {
  try {
    const { podId, requestId } = request.params;
    const access = await getResumeRequestWithAccess(requestId, podId, request.user.id);

    if (!access.exists) {
      return response.status(404).json({ message: "Resume review request not found." });
    }

    if (!access.isRequester && !access.canAdmin) {
      return response.status(403).json({ message: "Only the requester or pod admins can view feedback." });
    }

    return response.status(200).json({
      feedback: access.request.feedback.map((feedbackItem) => toResumeFeedbackResponse(feedbackItem, true)),
    });
  } catch (error) {
    return response.status(500).json({ message: "Failed to load feedback." });
  }
});

router.get("/:podId/resume-reviews/:requestId/my-feedback", requireAuth, async (request, response) => {
  try {
    const { podId, requestId } = request.params;
    const access = await getResumeRequestWithAccess(requestId, podId, request.user.id);

    if (!access.exists) {
      return response.status(404).json({ message: "Resume review request not found." });
    }

    const feedback = access.request.feedback.find((entry) => entry.reviewerId === request.user.id);
    if (!feedback) {
      return response.status(404).json({ message: "Your feedback was not found." });
    }

    return response.status(200).json({ feedback: toResumeFeedbackResponse(feedback, true) });
  } catch (error) {
    return response.status(500).json({ message: "Failed to load your feedback." });
  }
});

router.patch("/:podId/resume-reviews/:requestId/status", requireAuth, async (request, response) => {
  try {
    const { podId, requestId } = request.params;
    const access = await getResumeRequestWithAccess(requestId, podId, request.user.id);

    if (!access.exists) {
      return response.status(404).json({ message: "Resume review request not found." });
    }

    if (!access.isRequester && !access.canAdmin) {
      return response.status(403).json({ message: "Only the requester or pod admins can update status." });
    }

    const payload = resumeStatusUpdateSchema.parse(request.body);

    const updated = await prisma.podResumeReviewRequest.update({
      where: { id: requestId },
      data: {
        status: payload.status,
        closedAt: payload.status === "CLOSED" || payload.status === "WITHDRAWN" ? new Date() : null,
      },
      include: {
        requester: true,
        file: true,
        feedback: { include: { reviewer: true } },
      },
    });

    return response.status(200).json({
      reviewRequest: toResumeReviewRequestResponse(updated, {
        includeFeedback: access.isRequester || access.canAdmin,
      }),
    });
  } catch (error) {
    if (error?.name === "ZodError") {
      return response.status(400).json({ message: "Invalid status payload.", issues: error.issues });
    }

    return response.status(500).json({ message: "Failed to update resume review status." });
  }
});

router.get("/:podId/checkin/current", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const today = new Date();
    const weekStartDate = getBiWeeklyStartDate(today);

    let checkIn = null;
    let reflection = null;
    let celebrations = [];

    try {
      checkIn = await prisma.podCheckIn.findUnique({
        where: {
          podId_userId_weekStartDate: {
            podId,
            userId: request.user.id,
            weekStartDate,
          },
        },
      });
    } catch (err) {
      console.log("No check-in for this period");
    }

    try {
      reflection = await prisma.podReflection.findUnique({
        where: {
          podId_userId_weekStartDate: {
            podId,
            userId: request.user.id,
            weekStartDate,
          },
        },
      });
    } catch (err) {
      console.log("No reflection for this period");
    }

    try {
      celebrations = await prisma.podCelebration.findMany({
        where: { podId, weekStartDate },
        include: { user: true },
      });
    } catch (err) {
      console.log("No celebrations for this period");
    }

    return response.status(200).json({
      weekStartDate,
      checkIn,
      reflection,
      celebrations,
      isActive: true,
    });
  } catch (error) {
    console.error("Error in /checkin/current:", error);
    return response.status(200).json({
      weekStartDate: new Date(),
      checkIn: null,
      reflection: null,
      celebrations: [],
      isActive: true,
    });
  }
});

router.post("/:podId/checkin", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const { notes, goals } = request.body;

    if (!notes?.trim() && !goals?.trim()) {
      return response.status(400).json({ message: "Notes or goals are required." });
    }

    const weekStartDate = getBiWeeklyStartDate(new Date());

    const checkIn = await prisma.podCheckIn.upsert({
      where: {
        podId_userId_weekStartDate: {
          podId,
          userId: request.user.id,
          weekStartDate,
        },
      },
      update: {
        notes: notes?.trim() || null,
        goals: goals?.trim() || null,
        status: "COMPLETED",
        updatedAt: new Date(),
      },
      create: {
        podId,
        userId: request.user.id,
        weekStartDate,
        notes: notes?.trim() || null,
        goals: goals?.trim() || null,
        status: "COMPLETED",
      },
    });

    return response.status(200).json({ checkIn });
  } catch (error) {
    console.error("Error saving check-in:", error);
    return response.status(500).json({ message: "Failed to save check-in." });
  }
});

router.post("/:podId/reflection", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const { content } = request.body;

    if (!content?.trim()) {
      return response.status(400).json({ message: "Reflection content is required." });
    }

    const weekStartDate = getBiWeeklyStartDate(new Date());

    await prisma.podReflection.deleteMany({
      where: { podId, userId: request.user.id, weekStartDate },
    });

    const reflection = await prisma.podReflection.create({
      data: {
        podId,
        userId: request.user.id,
        weekStartDate,
        content: content.trim(),
      },
    });

    return response.status(200).json({ reflection });
  } catch (error) {
    console.error("Error saving reflection:", error);
    return response.status(500).json({ message: "Failed to save reflection." });
  }
});

router.post("/:podId/celebrations", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const { title, description } = request.body;

    if (!title?.trim()) {
      return response.status(400).json({ message: "Celebration title is required." });
    }

    const weekStartDate = getBiWeeklyStartDate(new Date());

    const celebration = await prisma.podCelebration.create({
      data: {
        podId,
        userId: request.user.id,
        weekStartDate,
        title: title.trim(),
        description: description?.trim() || "",
      },
    });

    return response.status(201).json({ celebration });
  } catch (error) {
    return response.status(500).json({ message: "Failed to add celebration." });
  }
});

router.get("/:podId/celebrations/all", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const celebrations = await prisma.podCelebration.findMany({
      where: { podId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return response.status(200).json({ celebrations });
  } catch (error) {
    console.error("Error loading celebrations:", error);
    return response.status(500).json({ message: "Failed to load celebrations." });
  }
});

router.get("/:podId/checkins", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const weekStartDate = getBiWeeklyStartDate(new Date());

    const checkIns = await prisma.podCheckIn.findMany({
      where: { podId, weekStartDate },
      include: { user: true },
    });

    const reflections = await prisma.podReflection.findMany({
      where: { podId, weekStartDate },
      include: { user: true },
    });

    const memberData = checkIns.map(checkIn => ({
      ...checkIn,
      reflection: reflections.find(r => r.userId === checkIn.userId) || null,
    }));

    return response.status(200).json({ checkIns: memberData });
  } catch (error) {
    console.error("Error loading check-ins:", error);
    return response.status(500).json({ message: "Failed to load check-ins." });
  }
});

router.get("/:podId/reflections", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const weekStartDate = getBiWeeklyStartDate(new Date());

    const reflections = await prisma.podReflection.findMany({
      where: { podId, weekStartDate },
      include: { user: true },
    });

    return response.status(200).json({ reflections });
  } catch (error) {
    console.error("Error loading reflections:", error);
    return response.status(500).json({ message: "Failed to load reflections." });
  }
});

router.get("/:podId/phase", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const phase = await getCurrentPhase(podId);
    const prompt = await getPromptForPhase(podId, request.user.id, phase.currentPhase);

    response.status(200).json({
      phase: phase.currentPhase,
      phaseStartedAt: phase.phaseStartedAt,
      nextPhaseAt: phase.nextPhaseAt,
      prompt,
    });
  } catch (error) {
    console.error("Error in /phase:", error);
    response.status(200).json({
      phase: "MONDAY_SET",
      phaseStartedAt: new Date(),
      nextPhaseAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      prompt: {
        title: "Set Your Weekly Goals",
        questions: ["What are your top 3 goals for this week?"],
        placeholder: "This week, I will accomplish...",
      },
    });
  }
});

router.get("/:podId/stats", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;

    const checkinCount = await prisma.podCheckIn.count({ where: { podId } });
    const reflectionCount = await prisma.podReflection.count({ where: { podId } });
    const celebrationCount = await prisma.podCelebration.count({ where: { podId } });

    response.status(200).json({
      historicalStats: [],
      currentWeek: {
        active_members: 1,
        total_checkins: checkinCount,
        total_reflections: reflectionCount,
        total_celebrations: celebrationCount,
        completion_rate: checkinCount > 0 ? 100 : 0,
      },
    });
  } catch (error) {
    console.error("Error in /stats:", error);
    response.status(500).json({ message: "Failed to load stats." });
  }
});

router.get("/notifications", requireAuth, async (request, response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: request.user.id, sentAt: { not: null } },
      orderBy: { scheduledAt: "desc" },
      take: 20,
    });
    response.status(200).json({ notifications: notifications || [] });
  } catch (error) {
    console.error("Error loading notifications:", error);
    response.status(500).json({ message: "Failed to load notifications." });
  }
});

router.patch("/notifications/:notificationId/read", requireAuth, async (request, response) => {
  try {
    await prisma.notification.update({
      where: { id: request.params.notificationId },
      data: { readAt: new Date() },
    });
    response.status(200).json({ message: "Notification marked as read." });
  } catch (error) {
    response.status(500).json({ message: "Failed to update notification." });
  }
});

router.get("/:podId", requireAuth, async (request, response) => {
  try {
    const pod = await prisma.pod.findUnique({
      where: { id: request.params.podId },
      include: {
        memberships: {
          where: { userId: request.user.id },
          select: { role: true, status: true },
          take: 1,
        },
        _count: {
          select: { memberships: { where: { status: "ACTIVE" } } },
        },
      },
    });

    if (!pod) {
      return response.status(404).json({ message: "Pod not found." });
    }

    return response.status(200).json({ pod: toPodResponse(pod) });
  } catch {
    return response.status(500).json({ message: "Failed to load pod." });
  }
});

export { router as podRoutes };