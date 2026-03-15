import jwt from "jsonwebtoken";
import { config, isProd } from "../config.js";

const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7;

export function signAuthToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export function verifyAuthToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function setAuthCookie(response, token) {
  response.cookie(config.authCookieName, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: ONE_WEEK_MS,
    path: "/",
  });
}

export function clearAuthCookie(response) {
  response.clearCookie(config.authCookieName, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });
}
