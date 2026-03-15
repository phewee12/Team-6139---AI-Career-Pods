import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";
import { verifyAuthToken } from "../utils/jwt.js";

export async function requireAuth(request, response, next) {
  try {
    const token = request.cookies[config.authCookieName];

    if (!token) {
      return response.status(401).json({ message: "Authentication required." });
    }

    const payload = verifyAuthToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      return response.status(401).json({ message: "Invalid session." });
    }

    request.user = user;
    return next();
  } catch (error) {
    return response.status(401).json({ message: "Invalid or expired session." });
  }
}
