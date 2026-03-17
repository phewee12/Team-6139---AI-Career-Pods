import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { toPublicUser } from "../utils/users.js";

const router = Router();

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

router.get("/:podId", requireAuth, async (request, response) => {
  try {
    const pod = await prisma.pod.findUnique({
      where: { id: request.params.podId },
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

    if (!pod) {
      return response.status(404).json({ message: "Pod not found." });
    }

    return response.status(200).json({ pod: toPodResponse(pod) });
  } catch {
    return response.status(500).json({ message: "Failed to load pod." });
  }
});

//USER STORY 3: Pod Onboarding Routes

// Get pod onboarding status
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

// Complete pod onboarding
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

    // Update membership with onboarding data
    const updated = await prisma.podMembership.update({
      where: { id: membership.id },
      data: {
        onboardedAt: new Date(),
        introMessage: introMessage.trim(),
      },
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

// Get all members of a pod
router.get("/:podId/members", requireAuth, async (request, response) => {
  try {
    const { podId } = request.params;

    // Check if user has access to this pod
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
        { role: "desc" }, // ADMINS first
        { joinedAt: "asc" },
      ],
    });

    return response.status(200).json({
      members: members.map(m => ({
        id: m.user.id,
        email: m.user.email,
        fullName: m.user.fullName,
        fieldOfStudy: m.user.fieldOfStudy,
        careerStage: m.user.careerStage,
        targetTimeline: m.user.targetTimeline,
        avatarUrl: m.user.avatarUrl,
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

// Get user's pods (for "My Pods" view)
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

export { router as podRoutes };
