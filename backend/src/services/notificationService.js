import { prisma } from "../lib/prisma.js";

function now() {
  return new Date();
}

async function getActivePodMemberIds(podId, excludeUserIds = [], db = prisma) {
  const excluded = new Set((Array.isArray(excludeUserIds) ? excludeUserIds : [excludeUserIds]).filter(Boolean));

  const memberships = await db.podMembership.findMany({
    where: {
      podId,
      status: "ACTIVE",
      ...(excluded.size > 0
        ? {
            userId: {
              notIn: [...excluded],
            },
          }
        : {}),
    },
    select: { userId: true },
  });

  return memberships.map((membership) => membership.userId);
}

async function createNotifications(db, notifications) {
  if (!notifications.length) {
    return [];
  }

  await db.notification.createMany({
    data: notifications,
  });

  return notifications;
}

function buildNotifications({ podId, userIds, senderId = null, type, title, message, scheduledAt = now() }) {
  const timestamp = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);

  return userIds.map((userId) => ({
    userId,
    senderId,
    podId,
    type,
    title,
    message,
    scheduledAt: timestamp,
    sentAt: timestamp,
  }));
}

function phaseNotificationContent(phase) {
  switch (phase) {
    case "WEDNESDAY_CHECK":
      return {
        type: "CHECK_IN_REMINDER",
        title: "Mid-week check-in is ready",
        message: "Your pod is in the mid-week check-in phase. Share progress, blockers, and updates.",
      };
    case "FRIDAY_REFLECT":
      return {
        type: "REFLECTION_REMINDER",
        title: "Week reflection is ready",
        message: "Your pod is in the reflection phase. Share what you accomplished and what you learned.",
      };
    case "WEEKEND_BREAK":
      return {
        type: "PHASE_REMINDER",
        title: "Weekend break",
        message: "Your pod is in a weekend break phase. Take a reset and come back ready next week.",
      };
    case "MONDAY_SET":
    default:
      return {
        type: "PHASE_REMINDER",
        title: "Weekly goals are ready",
        message: "Your pod is in the weekly planning phase. Set your goals and align on priorities.",
      };
  }
}

export async function notifyPodMembers(podId, { type, title, message, excludeUserIds = [], senderId = null }, db = prisma) {
  const userIds = await getActivePodMemberIds(podId, excludeUserIds, db);
  return createNotifications(db, buildNotifications({ podId, userIds, senderId, type, title, message }));
}

export async function notifyPodMember(podId, userId, { type, title, message, senderId = null }, db = prisma) {
  if (!userId) {
    return [];
  }

  return createNotifications(
    db,
    buildNotifications({ podId, userIds: [userId], senderId, type, title, message }),
  );
}

export async function notifyPhaseChange(podId, phase, db = prisma) {
  const content = phaseNotificationContent(phase);
  return notifyPodMembers(podId, content, db);
}

export async function notifyMemberJoined({ podId, senderUserId, senderName }, db = prisma) {
  return notifyPodMembers(
    podId,
    {
      type: "MEMBER_JOINED",
      title: `${senderName || "A pod member"} joined the group`,
      message: `${senderName || "A pod member"} has joined the group. Say hello and welcome them in.`,
      excludeUserIds: senderUserId ? [senderUserId] : [],
      senderId: senderUserId || null,
    },
    db,
  );
}

export async function notifyCelebrationCreated(podId, actorUserId, celebrationTitle, db = prisma) {
  return notifyPodMembers(
    podId,
    {
      type: "CELEBRATION_ALERT",
      title: `New celebration: ${celebrationTitle}`,
      message: "Someone in your pod shared a new celebration. Open the celebrations feed to read it.",
      excludeUserIds: actorUserId ? [actorUserId] : [],
      senderId: actorUserId || null,
    },
    db,
  );
}

export async function notifyResumeReviewReceived({ podId, requesterId, reviewerName, requestTitle, senderUserId = null }, db = prisma) {
  return notifyPodMember(
    podId,
    requesterId,
    {
      type: "RESUME_REVIEW_RECEIVED",
      title: `New resume feedback: ${requestTitle}`,
      message: `${reviewerName || "Someone"} submitted resume feedback on your request.`,
      senderId: senderUserId,
    },
    db,
  );
}

export async function notifyNudgeReceived({ podId, toUserId, fromUserName, senderUserId = null }, db = prisma) {
  return notifyPodMember(
    podId,
    toUserId,
    {
      type: "NUDGE_RECEIVED",
      title: "You received a nudge",
      message: `${fromUserName || "A pod member"} sent you a nudge. Open accountability to respond.`,
      senderId: senderUserId,
    },
    db,
  );
}

export async function notifyQuietModeNotice({ podId, userId, isEnabled }, db = prisma) {
  return notifyPodMember(
    podId,
    userId,
    {
      type: "QUIET_MODE_NOTICE",
      title: isEnabled ? "Quiet mode enabled" : "Quiet mode ended",
      message: isEnabled
        ? "Your quiet mode is active. Pod notifications will be reduced for now."
        : "Quiet mode has ended. You will receive normal pod notifications again.",
    },
    db,
  );
}
