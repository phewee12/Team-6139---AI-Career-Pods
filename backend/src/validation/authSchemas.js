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
});
