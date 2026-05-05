import { prisma } from "../src/lib/prisma.js";
import { rankPodsForUser } from "../src/services/discoveryRecommendationService.js";

try {
  const user = await prisma.user.findFirst();
  console.log("user", user?.id);

  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      fieldOfStudy: true,
      careerStage: true,
      targetTimeline: true,
      locationCity: true,
      preferredGroupSize: true,
    },
  });

  const pods = await prisma.pod.findMany({
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        select: {
          userId: true,
          role: true,
          status: true,
          user: {
            select: {
              fieldOfStudy: true,
              careerStage: true,
              targetTimeline: true,
            },
          },
        },
      },
      posts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      podCheckIns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
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

  console.log("pods", pods.length);
  const ranked = rankPodsForUser(pods, currentUser);
  console.log(JSON.stringify(ranked[0], null, 2));
} catch (error) {
  console.error(error);
} finally {
  await prisma.$disconnect();
}
