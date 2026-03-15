import bcrypt from "bcrypt";
import { Router } from "express";
import passport from "passport";
import { config, isGoogleConfigured } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { clearAuthCookie, setAuthCookie, signAuthToken } from "../utils/jwt.js";
import { toPublicUser } from "../utils/users.js";
import { loginSchema, registerSchema } from "../validation/authSchemas.js";

const router = Router();

router.post("/register", async (request, response) => {
  try {
    const data = registerSchema.parse(request.body);
    const email = data.email.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return response.status(409).json({ message: "Email is already registered." });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: data.fullName || null,
        authProvider: "LOCAL",
      },
    });

    const token = signAuthToken(user.id);
    setAuthCookie(response, token);

    return response.status(201).json({ user: toPublicUser(user) });
  } catch (error) {
    if (error?.name === "ZodError") {
      return response.status(400).json({ message: "Invalid registration data.", issues: error.issues });
    }

    return response.status(500).json({ message: "Failed to register user." });
  }
});

router.post("/login", async (request, response) => {
  try {
    const data = loginSchema.parse(request.body);
    const email = data.email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return response.status(401).json({ message: "Invalid email or password." });
    }

    if (!user.passwordHash) {
      return response
        .status(400)
        .json({ message: "This account uses OAuth. Use Google sign-in instead." });
    }

    const passwordMatches = await bcrypt.compare(data.password, user.passwordHash);
    if (!passwordMatches) {
      return response.status(401).json({ message: "Invalid email or password." });
    }

    const token = signAuthToken(user.id);
    setAuthCookie(response, token);

    return response.status(200).json({ user: toPublicUser(user) });
  } catch (error) {
    if (error?.name === "ZodError") {
      return response.status(400).json({ message: "Invalid login data.", issues: error.issues });
    }

    return response.status(500).json({ message: "Failed to login." });
  }
});

router.post("/logout", (_request, response) => {
  clearAuthCookie(response);
  return response.status(200).json({ message: "Logged out." });
});

router.get("/me", requireAuth, (request, response) => {
  return response.status(200).json({ user: toPublicUser(request.user) });
});

router.get("/google", (request, response, next) => {
  if (!isGoogleConfigured) {
    return response.status(501).json({
      message: "Google OAuth is not configured on the server.",
    });
  }

  return passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    session: false,
  })(request, response, next);
});

router.get("/google/callback", (request, response, next) => {
  if (!isGoogleConfigured) {
    return response.redirect(`${config.clientOrigin}/auth?error=google_not_configured`);
  }

  return passport.authenticate(
    "google",
    {
      session: false,
      failureRedirect: `${config.clientOrigin}/auth?error=google_auth_failed`,
    },
    (error, principal) => {
      if (error || !principal) {
        return response.redirect(`${config.clientOrigin}/auth?error=google_auth_failed`);
      }

      const token = signAuthToken(principal.id);
      setAuthCookie(response, token);

      return response.redirect(`${config.clientOrigin}/auth/callback`);
    },
  )(request, response, next);
});

export { router as authRoutes };
