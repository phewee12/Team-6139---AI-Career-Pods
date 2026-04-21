import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";
import { getSupabaseClient } from "../lib/supabase.js";
import { toPublicUser } from "../utils/users.js";
import { getCurrentPhase, getPromptForPhase } from "../services/phaseService.js";
import {
  notifyCelebrationCreated,
  notifyMemberJoined,
  notifyNudgeReplyReceived,
  notifyPodMembers,
  notifyQuietModeNotice,
  notifyResumeReviewReceived,
  notifyNudgeReceived,
} from "../services/notificationService.js";
import {
  generateStructuredFeedbackSuggestions,
  generateStructuredFeedbackSuggestionsFromPdf,
  generateFeedbackSummary,
} from "../services/resumeService.js";


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

const podUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().min(10).max(500).optional(),
    focusArea: z.string().trim().min(2).max(120).optional(),
    visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided.",
  });

const membershipDecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

const membershipRoleUpdateSchema = z.object({
  role: z.literal("ADMIN"),
});

const podPostCreateSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

const resumeReviewCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  targetRole: z.string().trim().max(120).optional().or(z.literal("")),
  context: z.string().trim().max(4000).optional().or(z.literal("")),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(["application/pdf"]),
  contentBase64: z.string().min(1),
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
  status: z.enum(["CLOSED"]),
});

const accountabilityNudgeSchema = z.object({
  toUserId: z.string().min(1),
  message: z.string().trim().min(1).max(500),
  templateId: z.string().trim().max(120).optional().or(z.literal("")),
});

const accountabilityNudgeResponseSchema = z.object({
  quickReplyId: z.string().trim().min(1).max(120),
});

const quietModeSchema = z.object({
  enabled: z.boolean(),
  until: z.string().datetime().nullable().optional(),
  announcedToPod: z.boolean().optional(),
});

const NUDGE_QUICK_REPLY_ID_TO_ENUM = {
  busy_okay: "BUSY_OKAY",
  need_support: "NEED_SUPPORT",
  catch_up: "CATCH_UP",
  lets_chat: "LETS_CHAT",
};

const NUDGE_QUICK_REPLY_ENUM_TO_ID = Object.fromEntries(
  Object.entries(NUDGE_QUICK_REPLY_ID_TO_ENUM).map(([id, value]) => [value, id]),
);

const NUDGE_QUICK_REPLY_LABELS = {
  busy_okay: "Doing okay, just busy!",
  need_support: "Could use some support",
  catch_up: "I'll catch up this weekend",
  lets_chat: "Can we chat?",
};

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

function isPrivilegedPodRole(role) {
  return role === "OWNER" || role === "ADMIN";
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
          role: {
            in: ["OWNER", "ADMIN"],
          },
        },
        select: { id: true, role: true },
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
  const isAdmin = pod.createdById === userId || isPrivilegedPodRole(activeMembership?.role);

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
  const { includeFeedback = false, redactFeedback = false, currentUserId = null } = options;
  const feedbackCount = reviewRequest.feedback?.length || 0;
  const hasCurrentUserFeedback = Boolean(
    currentUserId && reviewRequest.feedback?.some((feedbackItem) => feedbackItem.reviewerId === currentUserId),
  );

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
          uploadedById: reviewRequest.file.uploadedById,
          uploadedAt: reviewRequest.file.uploadedAt,
        }
      : null,
    feedbackCount,
    hasCurrentUserFeedback,
    canCurrentUserReview: Boolean(
      currentUserId &&
        reviewRequest.status === "OPEN" &&
        reviewRequest.requesterId !== currentUserId &&
        !hasCurrentUserFeedback,
    ),
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

function toNudgeHistoryEntry(nudge, currentUserId) {
  const quickReplyId = nudge.response ? NUDGE_QUICK_REPLY_ENUM_TO_ID[nudge.response] || null : null;
  const fromUser = nudge.fromUser ? toPublicUser(nudge.fromUser) : null;
  const toUser = nudge.toUser ? toPublicUser(nudge.toUser) : null;

  return {
    id: nudge.id,
    fromUserId: nudge.fromUserId,
    toUserId: nudge.toUserId,
    fromName: fromUser?.fullName || fromUser?.email || null,
    toName: toUser?.fullName || toUser?.email || null,
    preview: nudge.message ? nudge.message.slice(0, 120) : "",
    sentAt: nudge.sentAt,
    readAt: nudge.readAt,
    respondedAt: nudge.respondedAt,
    quickReply: quickReplyId ? NUDGE_QUICK_REPLY_LABELS[quickReplyId] || quickReplyId : null,
    quickReplyId,
    displayAsAnonymous: false,
  };
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
}

function decodeBase64Pdf(contentBase64) {
  const normalized = contentBase64.includes(",") ? contentBase64.split(",").pop() : contentBase64;
  return Buffer.from(normalized, "base64");
}

async function uploadResumePdfToStorage({ podId, requestId, userId, fileName, mimeType, contentBase64 }) {
  const fileBuffer = decodeBase64Pdf(contentBase64);

  if (fileBuffer.length === 0) {
    const error = new Error("Resume file is empty.");
    error.status = 400;
    throw error;
  }

  const maxFileSizeBytes = 10 * 1024 * 1024;
  if (fileBuffer.length > maxFileSizeBytes) {
    const error = new Error("Resume file must be 10MB or smaller.");
    error.status = 400;
    throw error;
  }

  const supabase = getSupabaseClient();
  const safeFileName = sanitizeFileName(fileName || "resume.pdf");
  const storageBucket = config.supabaseStorageBucket;
  const storagePath = `${podId}/${requestId}/${userId}/${Date.now()}-${safeFileName}`;

  const uploadResult = await supabase.storage.from(storageBucket).upload(storagePath, fileBuffer, {
    contentType: mimeType,
    upsert: true,
  });

  if (uploadResult.error) {
    const error = new Error(uploadResult.error.message || "Failed to upload resume file.");
    error.status = 500;
    throw error;
  }

  return {
    storageBucket,
    storagePath,
    sizeBytes: fileBuffer.length,
    originalFileName: fileName,
    mimeType,
  };
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
          role: "OWNER",
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

router.patch("/:podId", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const data = podUpdateSchema.parse(request.body);

    const access = await getPodAccessContext(podId, request.user.id);

    if (!access.exists) {
      return response.status(404).json({ message: "Pod not found." });
    }

    if (!access.isAdmin) {
      return response.status(403).json({ message: "Admin access required." });
    }

    await prisma.pod.update({
      where: { id: podId },
      data,
    });

    const updatedPod = await prisma.pod.findUnique({
      where: { id: podId },
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

    return response.status(200).json({ pod: toPodResponse(updatedPod) });
  } catch (error) {
    if (error?.name === "ZodError") {
      return response.status(400).json({ message: "Invalid pod settings payload.", issues: error.issues });
    }

    return response.status(500).json({ message: "Failed to update pod settings." });
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
        membershipId: m.id,
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

router.patch("/:podId/members/:membershipId/role", requireAuth, async (request, response) => {
  try {
    const { podId, membershipId } = request.params;
    const data = membershipRoleUpdateSchema.parse(request.body);

    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      select: {
        id: true,
        createdById: true,
      },
    });

    if (!pod) {
      return response.status(404).json({ message: "Pod not found." });
    }

    if (pod.createdById !== request.user.id) {
      return response.status(403).json({ message: "Owner access required." });
    }

    const membership = await prisma.podMembership.findFirst({
      where: {
        id: membershipId,
        podId,
        status: "ACTIVE",
      },
      include: { user: true },
    });

    if (!membership) {
      return response.status(404).json({ message: "Active membership not found." });
    }

    if (membership.userId === pod.createdById || membership.role === "OWNER") {
      return response.status(400).json({ message: "Owner role cannot be changed." });
    }

    if (membership.role === data.role) {
      return response.status(200).json({
        membership: toMembershipResponse(membership),
      });
    }

    const updatedMembership = await prisma.podMembership.update({
      where: { id: membership.id },
      data: {
        role: data.role,
        reviewedAt: new Date(),
        reviewedById: request.user.id,
      },
    });

    return response.status(200).json({
      membership: toMembershipResponse(updatedMembership),
    });
  } catch (error) {
    if (error?.name === "ZodError") {
      return response.status(400).json({ message: "Invalid role update payload.", issues: error.issues });
    }

    return response.status(500).json({ message: "Failed to update member role." });
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

      try {
        await notifyMemberJoined({
          podId,
          senderUserId: request.user.id,
          senderName: request.user.fullName || request.user.email,
        });
      } catch (notificationError) {
        console.warn("Failed to send member-joined notification:", notificationError?.message || notificationError);
      }

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
      const access = await getPodAccessContext(podId, request.user.id);

      if (!access.exists) {
        return response.status(404).json({ message: "Pod not found." });
      }

      if (!access.isAdmin) {
        return response.status(403).json({ message: "Admin access required." });
      }
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
      include: { user: true },
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

      if (decision.action === "approve") {
        try {
          await notifyMemberJoined({
            podId,
            senderUserId: pendingMembership.userId,
            senderName: pendingMembership.user?.fullName || pendingMembership.user?.email || "A pod member",
          });
        } catch (notificationError) {
          console.warn("Failed to send member-joined notification:", notificationError?.message || notificationError);
        }
      }

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

    const requestId = randomUUID();
    const upload = await uploadResumePdfToStorage({
      podId,
      requestId,
      userId: request.user.id,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      contentBase64: payload.contentBase64,
    });

    const reviewRequest = await prisma.podResumeReviewRequest.create({
      data: {
        id: requestId,
        podId,
        requesterId: request.user.id,
        title: payload.title,
        targetRole: payload.targetRole || null,
        context: payload.context || null,
        file: {
          create: {
            uploadedById: request.user.id,
            storageBucket: upload.storageBucket,
            storagePath: upload.storagePath,
            originalFileName: upload.originalFileName,
            mimeType: upload.mimeType,
            sizeBytes: upload.sizeBytes,
          },
        },
      },
      include: {
        requester: true,
        file: true,
        feedback: { include: { reviewer: true } },
      },
    });

    return response.status(201).json({ reviewRequest: toResumeReviewRequestResponse(reviewRequest) });
  } catch (error) {
    if (error?.status === 400) {
      return response.status(400).json({ message: error.message });
    }

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
    const upload = await uploadResumePdfToStorage({
      podId,
      requestId,
      userId: request.user.id,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      contentBase64: payload.contentBase64,
    });

    const fileRecord = await prisma.podResumeFile.upsert({
      where: { requestId },
      update: {
        uploadedById: request.user.id,
        storageBucket: upload.storageBucket,
        storagePath: upload.storagePath,
        originalFileName: payload.fileName,
        mimeType: payload.mimeType,
        sizeBytes: upload.sizeBytes,
      },
      create: {
        requestId,
        uploadedById: request.user.id,
        storageBucket: upload.storageBucket,
        storagePath: upload.storagePath,
        originalFileName: payload.fileName,
        mimeType: payload.mimeType,
        sizeBytes: upload.sizeBytes,
      },
    });

    return response.status(200).json({
      file: {
        id: fileRecord.id,
        requestId: fileRecord.requestId,
        originalFileName: fileRecord.originalFileName,
        mimeType: fileRecord.mimeType,
        sizeBytes: fileRecord.sizeBytes,
        uploadedAt: fileRecord.uploadedAt,
      },
    });
  } catch (error) {
    if (error?.status === 400) {
      return response.status(400).json({ message: error.message });
    }

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
          currentUserId: request.user.id,
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
        currentUserId: request.user.id,
        includeFeedback: access.isRequester || access.canAdmin,
        redactFeedback: !access.isRequester && !access.canAdmin,
      }),
    });
  } catch (error) {
    return response.status(500).json({ message: "Failed to load resume review request." });
  }
});

router.get("/:podId/resume-reviews/:requestId/file-url", requireAuth, async (request, response) => {
  try {
    const { podId, requestId } = request.params;
    const access = await getResumeRequestWithAccess(requestId, podId, request.user.id);

    if (!access.exists) {
      return response.status(404).json({ message: "Resume review request not found." });
    }

    if (!access.canView) {
      return response.status(403).json({ message: "Active membership required." });
    }

    if (!access.request.file) {
      return response.status(404).json({ message: "No resume file found for this request." });
    }

    const supabase = getSupabaseClient();
    const expiresInSeconds = 600;
    const signed = await supabase.storage
      .from(access.request.file.storageBucket)
      .createSignedUrl(access.request.file.storagePath, expiresInSeconds);

    if (signed.error || !signed.data?.signedUrl) {
      return response.status(500).json({ message: signed.error?.message || "Failed to generate file access URL." });
    }

    return response.status(200).json({
      signedUrl: signed.data.signedUrl,
      expiresInSeconds,
      file: {
        id: access.request.file.id,
        originalFileName: access.request.file.originalFileName,
        mimeType: access.request.file.mimeType,
        sizeBytes: access.request.file.sizeBytes,
        uploadedAt: access.request.file.uploadedAt,
      },
    });
  } catch (error) {
    return response.status(500).json({ message: "Failed to generate file URL." });
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

    if (access.request.status !== "OPEN") {
      return response.status(400).json({ message: "This review request is closed and no longer accepts feedback." });
    }

    if (access.request.requesterId === request.user.id) {
      return response.status(403).json({ message: "You cannot review your own resume." });
    }

    const membership = await getActiveMembership(podId, request.user.id);
    if (!membership || membership.status !== "ACTIVE") {
      return response.status(403).json({ message: "Active membership required." });
    }

    const existingFeedback = await prisma.podResumeReviewFeedback.findUnique({
      where: {
        requestId_reviewerId: {
          requestId,
          reviewerId: request.user.id,
        },
      },
    });

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

    if (!existingFeedback) {
      try {
        await notifyResumeReviewReceived({
          podId,
          requesterId: access.request.requesterId,
          reviewerName: request.user.fullName || request.user.email,
          requestTitle: access.request.title,
        });
      } catch (notificationError) {
        console.warn("Failed to send resume review notification:", notificationError?.message || notificationError);
      }
    }

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
        closedAt: payload.status === "CLOSED" ? new Date() : null,
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

router.delete("/:podId/resume-reviews/:requestId", requireAuth, async (request, response) => {
  try {
    const { podId, requestId } = request.params;
    const access = await getResumeRequestWithAccess(requestId, podId, request.user.id);

    if (!access.exists) {
      return response.status(404).json({ message: "Resume review request not found." });
    }

    if (!access.isRequester && !access.canAdmin) {
      return response.status(403).json({ message: "Only the requester or pod admins can delete this request." });
    }

    await prisma.podResumeReviewRequest.delete({ where: { id: requestId } });

    return response.status(200).json({ message: "Resume review request deleted." });
  } catch (error) {
    return response.status(500).json({ message: "Failed to delete resume review request." });
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

    try {
      await notifyCelebrationCreated(podId, request.user.id, celebration.title);
    } catch (notificationError) {
      console.warn("Failed to send celebration notification:", notificationError?.message || notificationError);
    }

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

router.get("/:podId/accountability", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const userId = request.user.id;

    const membership = await getActiveMembership(podId, userId);
    if (!membership || membership.status !== "ACTIVE") {
      return response.status(403).json({ message: "You must be an active member." });
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const memberships = await prisma.podMembership.findMany({
      where: { podId, status: "ACTIVE" },
      include: { user: true },
    });

    const sentNudges = await prisma.nudge.findMany({
      where: { podId, fromUserId: userId },
      orderBy: { sentAt: "desc" },
      take: 100,
      include: {
        fromUser: true,
        toUser: true,
      },
    });

    const receivedNudges = await prisma.nudge.findMany({
      where: { podId, toUserId: userId },
      orderBy: { sentAt: "desc" },
      take: 100,
      include: {
        fromUser: true,
        toUser: true,
      },
    });

    const quietModes = await prisma.quietMode.findMany({
      where: {
        podId,
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
      select: {
        userId: true,
        endDate: true,
      },
    });

    const userQuietMode = await prisma.quietMode.findUnique({
      where: {
        userId_podId: {
          userId,
          podId,
        },
      },
    });

    const sentCountThisMonth = await prisma.nudge.count({
      where: {
        podId,
        fromUserId: userId,
        sentAt: { gte: monthStart, lt: nextMonthStart },
      },
    });

    const receivedCountThisMonth = await prisma.nudge.count({
      where: {
        podId,
        toUserId: userId,
        sentAt: { gte: monthStart, lt: nextMonthStart },
      },
    });

    const activeQuietUserIds = new Set(quietModes.map((entry) => entry.userId));
    const eligibility = {};

    for (const podMembership of memberships) {
      if (podMembership.userId === userId) {
        continue;
      }

      const nudgesPaused = activeQuietUserIds.has(podMembership.userId);
      eligibility[podMembership.userId] = {
        canNudge: !nudgesPaused,
        reasons: nudgesPaused ? [] : ["MISSED_GOALS"],
        nudgesPaused,
      };
    }

    const isQuietModeActive =
      Boolean(userQuietMode) && (!userQuietMode.endDate || userQuietMode.endDate.getTime() > Date.now());

    return response.status(200).json({
      eligibility,
      history: {
        sent: sentNudges.map((nudge) => toNudgeHistoryEntry(nudge, userId)),
        received: receivedNudges.map((nudge) => toNudgeHistoryEntry(nudge, userId)),
      },
      scorecard: {
        nudgesSentThisMonth: sentCountThisMonth,
        nudgesReceivedThisMonth: receivedCountThisMonth,
      },
      quietMode: {
        enabled: isQuietModeActive,
        until: isQuietModeActive ? userQuietMode.endDate : null,
        announcedToPod: userQuietMode ? userQuietMode.autoNotify : true,
      },
    });
  } catch (error) {
    console.error("Error loading accountability:", error);
    return response.status(500).json({ message: "Failed to load accountability." });
  }
});

router.post("/:podId/nudges", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const userId = request.user.id;
    const data = accountabilityNudgeSchema.parse(request.body);

    if (data.toUserId === userId) {
      return response.status(400).json({ message: "You cannot send a nudge to yourself." });
    }

    const senderMembership = await getActiveMembership(podId, userId);
    if (!senderMembership || senderMembership.status !== "ACTIVE") {
      return response.status(403).json({ message: "You must be an active member to send nudges." });
    }

    const recipientMembership = await getActiveMembership(podId, data.toUserId);
    if (!recipientMembership || recipientMembership.status !== "ACTIVE") {
      return response.status(404).json({ message: "Recipient is not an active pod member." });
    }

    const recipientQuietMode = await prisma.quietMode.findUnique({
      where: {
        userId_podId: {
          userId: data.toUserId,
          podId,
        },
      },
      select: {
        endDate: true,
      },
    });

    const recipientPaused =
      Boolean(recipientQuietMode) &&
      (!recipientQuietMode.endDate || recipientQuietMode.endDate.getTime() > Date.now());

    if (recipientPaused) {
      return response.status(409).json({ message: "This member has paused nudges for now." });
    }

    const createdNudge = await prisma.$transaction(async (transaction) => {
      const sentAt = new Date();
      const nudge = await transaction.nudge.create({
        data: {
          podId,
          fromUserId: userId,
          toUserId: data.toUserId,
          nudgeType: data.templateId ? "TEMPLATE" : "CUSTOM",
          templateId: data.templateId || null,
          message: data.message,
          sentAt,
          sentHourUtc: sentAt.getUTCHours(),
          sentDowUtc: sentAt.getUTCDay(),
        },
        include: {
          fromUser: true,
          toUser: true,
        },
      });

      await notifyNudgeReceived(
        {
          podId,
          toUserId: data.toUserId,
          fromUserName: request.user.fullName || request.user.email,
          senderUserId: userId,
        },
        transaction,
      );

      return nudge;
    });

    return response.status(201).json({
      nudge: toNudgeHistoryEntry(createdNudge, userId),
    });
  } catch (error) {
    if (error?.name === "ZodError") {
      return response.status(400).json({ message: "Invalid nudge payload.", issues: error.issues });
    }

    console.error("Error creating nudge:", error);
    return response.status(500).json({ message: "Failed to send nudge." });
  }
});

router.post("/:podId/nudges/:nudgeId/respond", requireAuth, async (request, response) => {
  try {
    const { podId, nudgeId } = request.params;
    const userId = request.user.id;
    const data = accountabilityNudgeResponseSchema.parse(request.body);

    const membership = await getActiveMembership(podId, userId);
    if (!membership || membership.status !== "ACTIVE") {
      return response.status(403).json({ message: "You must be an active member." });
    }

    const quickReplyEnum = NUDGE_QUICK_REPLY_ID_TO_ENUM[data.quickReplyId];
    if (!quickReplyEnum) {
      return response.status(400).json({ message: "Invalid quick reply id." });
    }

    const nudge = await prisma.nudge.findFirst({
      where: {
        id: nudgeId,
        podId,
      },
      include: {
        fromUser: true,
        toUser: true,
      },
    });

    if (!nudge) {
      return response.status(404).json({ message: "Nudge not found." });
    }

    if (nudge.toUserId !== userId) {
      return response.status(403).json({ message: "Only the recipient can respond to this nudge." });
    }

    const now = new Date();
    const updatedNudge = await prisma.nudge.update({
      where: { id: nudge.id },
      data: {
        response: quickReplyEnum,
        respondedAt: now,
        readAt: nudge.readAt || now,
      },
      include: {
        fromUser: true,
        toUser: true,
      },
    });

    await notifyNudgeReplyReceived({
      podId,
      originalSenderUserId: updatedNudge.fromUserId,
      responderName: request.user.fullName || request.user.email,
      senderUserId: userId,
    });

    return response.status(200).json({
      nudge: toNudgeHistoryEntry(updatedNudge, userId),
    });
  } catch (error) {
    if (error?.name === "ZodError") {
      return response.status(400).json({ message: "Invalid nudge response payload.", issues: error.issues });
    }

    console.error("Error responding to nudge:", error);
    return response.status(500).json({ message: "Failed to submit nudge response." });
  }
});

router.put("/:podId/accountability/quiet-mode", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;
    const userId = request.user.id;
    const data = quietModeSchema.parse(request.body);

    const membership = await getActiveMembership(podId, userId);
    if (!membership || membership.status !== "ACTIVE") {
      return response.status(403).json({ message: "You must be an active member." });
    }

    if (!data.enabled) {
      await prisma.quietMode.deleteMany({
        where: {
          podId,
          userId,
        },
      });

      await notifyQuietModeNotice({
        podId,
        userId,
        isEnabled: false,
      });

      return response.status(200).json({
        quietMode: {
          enabled: false,
          until: null,
          announcedToPod: data.announcedToPod !== false,
        },
      });
    }

    const untilDate = data.until ? new Date(data.until) : null;

    const quietMode = await prisma.quietMode.upsert({
      where: {
        userId_podId: {
          userId,
          podId,
        },
      },
      create: {
        userId,
        podId,
        startDate: new Date(),
        endDate: untilDate,
        autoNotify: data.announcedToPod !== false,
      },
      update: {
        startDate: new Date(),
        endDate: untilDate,
        autoNotify: data.announcedToPod !== false,
      },
    });

    await notifyQuietModeNotice({
      podId,
      userId,
      isEnabled: true,
    });

    return response.status(200).json({
      quietMode: {
        enabled: true,
        until: quietMode.endDate,
        announcedToPod: quietMode.autoNotify,
      },
    });
  } catch (error) {
    if (error?.name === "ZodError") {
      return response.status(400).json({ message: "Invalid quiet mode payload.", issues: error.issues });
    }

    console.error("Error updating quiet mode:", error);
    return response.status(500).json({ message: "Failed to update quiet mode." });
  }
});

router.get("/notifications", requireAuth, async (request, response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: request.user.id, sentAt: { not: null } },
      orderBy: { scheduledAt: "desc" },
      take: 20,
      include: {
        user: true,
        sender: true,
        pod: true,
      },
    });

    response.status(200).json({
      notifications: (notifications || []).map((notification) => ({
        id: notification.id,
        podId: notification.podId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        scheduledAt: notification.scheduledAt,
        sentAt: notification.sentAt,
        readAt: notification.readAt,
        sender: notification.sender ? toPublicUser(notification.sender) : null,
        receiver: notification.user ? toPublicUser(notification.user) : null,
        pod: notification.pod
          ? {
              id: notification.pod.id,
              name: notification.pod.name,
              slug: notification.pod.slug,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Error loading notifications:", error);
    response.status(500).json({ message: "Failed to load notifications." });
  }
});

router.patch("/notifications/:notificationId/read", requireAuth, async (request, response) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        id: request.params.notificationId,
        userId: request.user.id,
      },
      data: { readAt: new Date() },
    });

    if (!result.count) {
      return response.status(404).json({ message: "Notification not found." });
    }

    response.status(200).json({ message: "Notification marked as read." });
  } catch (error) {
    response.status(500).json({ message: "Failed to update notification." });
  }
});

router.patch("/notifications/:notificationId/unread", requireAuth, async (request, response) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        id: request.params.notificationId,
        userId: request.user.id,
      },
      data: { readAt: null },
    });

    if (!result.count) {
      return response.status(404).json({ message: "Notification not found." });
    }

    response.status(200).json({ message: "Notification marked as unread." });
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


router.get("/:podId/resume-reviews/:requestId/ai-suggestions", requireAuth, async (request, response) => {
  const { podId, requestId } = request.params;
  const userId = request.user.id;

  try {
    const access = await getPodAccessContext(podId, userId);
    if (!access.isActiveMember) {
      return response.status(403).json({ message: "You must be an active pod member." });
    }

    const reviewRequest = await prisma.podResumeReviewRequest.findUnique({
      where: { id: requestId },
      include: { file: true },
    });

    if (!reviewRequest || reviewRequest.podId !== podId) {
      return response.status(404).json({ message: "Resume review request not found." });
    }

    // Build context from resume-specific fields only. Request title is metadata, not resume content.
    const context = [
      reviewRequest.targetRole ? `Target role: ${reviewRequest.targetRole}` : null,
      reviewRequest.context ? `Resume context from requester: ${reviewRequest.context}` : null,
    ]
      .filter(Boolean)
      .join(". ");

    let aiSuggestions;

    if (reviewRequest.file?.storagePath) {
      const bucket = reviewRequest.file.storageBucket || config.supabaseStorageBucket;
      const supabase = getSupabaseClient();
      const download = await supabase.storage.from(bucket).download(reviewRequest.file.storagePath);

      if (download.error) {
        throw new Error(download.error.message || "Failed to load resume file from storage.");
      }

      const fileBuffer = Buffer.from(await download.data.arrayBuffer());
      aiSuggestions = await generateStructuredFeedbackSuggestionsFromPdf({
        resumePdfBase64: fileBuffer.toString("base64"),
        resumeContext: context,
        targetRole: reviewRequest.targetRole,
      });
    } else {
      aiSuggestions = await generateStructuredFeedbackSuggestions(
        context || "No resume context was provided. Generate safe, general resume guidance.",
        reviewRequest.targetRole,
      );
    }

    const hasResumeContextText = Boolean(reviewRequest.context && reviewRequest.context.trim());
    const hasResumePdf = Boolean(reviewRequest.file?.storagePath);

    const atsResult = {
      atsScore: aiSuggestions.atsScore,
      found: [],
      missing: [],
      insufficientContext: !hasResumeContextText && !hasResumePdf,
    };

    return response.status(200).json({ aiSuggestions, atsResult });
  } catch (error) {
    console.error("AI suggestions error:", error);
    return response.status(500).json({ message: "Failed to generate AI suggestions." });
  }
});

// POST /api/pods/:podId/resume-reviews/:requestId/ai-summary
// Generates a final comments summary draft from the reviewer's in-progress feedback
router.post("/:podId/resume-reviews/:requestId/ai-summary", requireAuth, async (request, response) => {
  const { podId, requestId } = request.params;
  const userId = request.user.id;
  const { strengths, improvements, overallScore } = request.body;

  try {
    const access = await getPodAccessContext(podId, userId);
    if (!access.isActiveMember) {
      return response.status(403).json({ message: "You must be an active pod member." });
    }

    const reviewRequest = await prisma.podResumeReviewRequest.findUnique({
      where: { id: requestId },
    });

    if (!reviewRequest || reviewRequest.podId !== podId) {
      return response.status(404).json({ message: "Resume review request not found." });
    }

    const summary = await generateFeedbackSummary(
      strengths,
      improvements,
      overallScore,
      reviewRequest.targetRole
    );

    return response.status(200).json({ summary });
  } catch (error) {
    console.error("AI summary error:", error);
    return response.status(500).json({ message: "Failed to generate summary." });
  }
});

export { router as podRoutes };