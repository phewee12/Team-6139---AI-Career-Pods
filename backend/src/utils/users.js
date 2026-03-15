export function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    fieldOfStudy: user.fieldOfStudy,
    careerStage: user.careerStage,
    targetTimeline: user.targetTimeline,
    avatarUrl: user.avatarUrl,
    authProvider: user.authProvider,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function isProfileComplete(user) {
  return Boolean(user.fieldOfStudy && user.careerStage && user.targetTimeline);
}
