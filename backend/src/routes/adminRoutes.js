import { Router } from "express";
import { randomUUID } from "crypto";
import { config, isProd } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const DEFAULT_PODS = [
  {
    slug: "internship-accelerator",
    name: "Internship Accelerator",
    description:
      "Weekly accountability pod focused on internship applications, referrals, and interview prep.",
    focusArea: "Internships",
  },
  {
    slug: "grad-school-strategy",
    name: "Grad School Strategy",
    description:
      "Collaborative pod for statement reviews, school selection, and graduate admissions timelines.",
    focusArea: "Graduate School",
  },
  {
    slug: "career-switch-lab",
    name: "Career Switch Lab",
    description:
      "Support pod for career switchers building portfolios, networking plans, and transition roadmaps.",
    focusArea: "Career Change",
  },
];

router.post("/test/reset-db", requireAuth, async (request, response) => {
  if (isProd || !config.enableTestDbReset) {
    return response.status(403).json({ message: "Test DB reset is disabled." });
  }

  const confirmText = request.body?.confirmText?.trim();
  if (confirmText !== "RESET DATABASE") {
    return response.status(400).json({
      message: "Invalid confirmation text. Send confirmText as 'RESET DATABASE'.",
    });
  }

  if (config.testDbResetToken) {
    const suppliedToken = request.headers["x-reset-token"];
    if (suppliedToken !== config.testDbResetToken) {
      return response.status(401).json({ message: "Invalid reset token." });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.pod.deleteMany();
      await tx.user.deleteMany();

      await tx.pod.createMany({
        data: DEFAULT_PODS.map((pod) => ({
          id: randomUUID(),
          slug: pod.slug,
          name: pod.name,
          description: pod.description,
          focusArea: pod.focusArea,
          isDefault: true,
        })),
      });
    });

    return response.status(200).json({
      message: "Database reset complete. All user data was cleared and default pods were re-seeded.",
    });
  } catch {
    return response.status(500).json({ message: "Failed to reset database." });
  }
});

export { router as adminRoutes };
