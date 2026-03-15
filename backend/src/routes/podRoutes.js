import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (_request, response) => {
  try {
    const pods = await prisma.pod.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return response.status(200).json({ pods });
  } catch {
    return response.status(500).json({ message: "Failed to load pods." });
  }
});

export { router as podRoutes };
