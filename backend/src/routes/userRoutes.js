import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { toPublicUser } from "../utils/users.js";
import { profileSetupSchema } from "../validation/authSchemas.js";

const router = Router();

router.put("/profile", requireAuth, async (request, response) => {
  try {
    const data = profileSetupSchema.parse(request.body);

    const user = await prisma.user.update({
      where: { id: request.user.id },
      data: {
        fieldOfStudy: data.fieldOfStudy,
        careerStage: data.careerStage,
        targetTimeline: data.targetTimeline,
      },
    });

    return response.status(200).json({ user: toPublicUser(user) });
  } catch (error) {
    if (error?.name === "ZodError") {
      return response.status(400).json({ message: "Invalid profile data.", issues: error.issues });
    }

    return response.status(500).json({ message: "Failed to save profile." });
  }
});

export { router as userRoutes };

router.get("/profile", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        email: true,
        fieldOfStudy: true,
        careerStage: true,
        targetTimeline: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    console.error(err); // log the actual error
    res.status(500).json({ error: "Failed to get profile" });
  }
});
