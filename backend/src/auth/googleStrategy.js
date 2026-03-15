import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { config, isGoogleConfigured } from "../config.js";
import { prisma } from "../lib/prisma.js";

export function configureGooglePassport() {
  if (!isGoogleConfigured) {
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: config.googleClientId,
        clientSecret: config.googleClientSecret,
        callbackURL: config.googleCallbackUrl,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();

          if (!email) {
            return done(new Error("Google account is missing an email address."));
          }

          const user = await prisma.user.upsert({
            where: { email },
            update: {
              authProvider: "GOOGLE",
              googleId: profile.id,
              fullName: profile.displayName || null,
              avatarUrl: profile.photos?.[0]?.value || null,
            },
            create: {
              email,
              authProvider: "GOOGLE",
              googleId: profile.id,
              fullName: profile.displayName || null,
              avatarUrl: profile.photos?.[0]?.value || null,
            },
          });

          return done(null, { id: user.id });
        } catch (error) {
          return done(error);
        }
      },
    ),
  );
}
