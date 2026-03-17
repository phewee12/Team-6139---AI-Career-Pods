import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { toPublicUser } from "../utils/users.js";
import { profileSetupSchema } from "../validation/authSchemas.js";

const router = Router();
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function parseAvatarUpload(avatarUploadData, avatarUploadContentType) {
  const match = avatarUploadData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid avatar upload format.");
  }

  const embeddedContentType = match[1];
  const base64Payload = match[2];

  if (embeddedContentType !== avatarUploadContentType) {
    throw new Error("Avatar content type mismatch.");
  }

  if (!ALLOWED_AVATAR_CONTENT_TYPES.has(avatarUploadContentType)) {
    throw new Error("Unsupported avatar file type.");
  }

  const avatarBuffer = Buffer.from(base64Payload, "base64");

  if (!avatarBuffer.length) {
    throw new Error("Avatar file is empty.");
  }

  if (avatarBuffer.length > MAX_AVATAR_BYTES) {
    throw new Error("Avatar file must be 2MB or smaller.");
  }

  return avatarBuffer;
}

router.put("/profile", requireAuth, async (request, response) => {
  try {
    const data = profileSetupSchema.parse(request.body);
    const avatarUrl = data.avatarUrl?.trim() ? data.avatarUrl.trim() : null;

    const updateData = {
      fieldOfStudy: data.fieldOfStudy,
      careerStage: data.careerStage,
      targetTimeline: data.targetTimeline,
    };

    if (data.avatarUploadData && data.avatarUploadContentType) {
      try {
        const avatarBuffer = parseAvatarUpload(data.avatarUploadData, data.avatarUploadContentType);
        updateData.avatarData = avatarBuffer;
        updateData.avatarMimeType = data.avatarUploadContentType;
        updateData.avatarUrl = null;
      } catch (uploadError) {
        return response.status(400).json({ message: uploadError.message || "Invalid avatar upload." });
      }
    } else if (avatarUrl) {
      updateData.avatarUrl = avatarUrl;
      updateData.avatarData = null;
      updateData.avatarMimeType = null;
    }

    const user = await prisma.user.update({
      where: { id: request.user.id },
      data: updateData,
    });

    return response.status(200).json({ user: toPublicUser(user) });
  } catch (error) {
    if (error?.name === "ZodError") {
      return response.status(400).json({ message: "Invalid profile data.", issues: error.issues });
    }

    return response.status(500).json({ message: "Failed to save profile." });
  }
});

router.get("/:userId/avatar", requireAuth, async (request, response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: request.params.userId },
      select: {
        avatarData: true,
        avatarMimeType: true,
      },
    });

    if (!user?.avatarData || !user.avatarMimeType) {
      return response.status(404).json({ message: "Avatar not found." });
    }

    response.setHeader("Content-Type", user.avatarMimeType);
    response.setHeader("Cache-Control", "private, max-age=300");
    return response.status(200).send(Buffer.from(user.avatarData));
  } catch {
    return response.status(500).json({ message: "Failed to load avatar." });
  }
});

export { router as userRoutes };
