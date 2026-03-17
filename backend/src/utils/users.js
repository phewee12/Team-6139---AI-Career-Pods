import { config } from "../config.js";

function resolveAvatarImageUrl(user) {
  if (user.avatarUrl?.trim()) {
    return user.avatarUrl.trim();
  }

  if (user.avatarData && user.avatarMimeType) {
    return `${config.serverOrigin}/api/users/${user.id}/avatar`;
  }

  return null;
}

export function toPublicUser(user) {
  const hasAvatarUpload = Boolean(user.avatarData && user.avatarMimeType);

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    fieldOfStudy: user.fieldOfStudy,
    careerStage: user.careerStage,
    targetTimeline: user.targetTimeline,
    avatarUrl: user.avatarUrl,
    avatarImageUrl: resolveAvatarImageUrl(user),
    hasAvatarUpload,
    authProvider: user.authProvider,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function isProfileComplete(user) {
  return Boolean(user.fieldOfStudy && user.careerStage && user.targetTimeline);
}
