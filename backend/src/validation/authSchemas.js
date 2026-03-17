import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(2).max(60).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

export const profileSetupSchema = z.object({
  fieldOfStudy: z.string().trim().min(2).max(100),
  careerStage: z.string().trim().min(2).max(100),
  targetTimeline: z.string().trim().min(2).max(120),
  avatarUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  avatarUploadData: z.string().trim().max(4_000_000).optional(),
  avatarUploadContentType: z
    .enum(["image/png", "image/jpeg", "image/webp", "image/gif"])
    .optional(),
}).superRefine((data, context) => {
  const hasUploadData = Boolean(data.avatarUploadData);
  const hasUploadType = Boolean(data.avatarUploadContentType);

  if (hasUploadData !== hasUploadType) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Avatar upload requires both data and content type.",
      path: hasUploadData ? ["avatarUploadContentType"] : ["avatarUploadData"],
    });
  }
});
