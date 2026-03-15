import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import passport from "passport";
import { configureGooglePassport } from "./auth/googleStrategy.js";
import { config } from "./config.js";
import { authRoutes } from "./routes/authRoutes.js";
import { podRoutes } from "./routes/podRoutes.js";
import { userRoutes } from "./routes/userRoutes.js";

const app = express();

configureGooglePassport();

app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.get("/api/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/pods", podRoutes);

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ message: "Unexpected server error." });
});

export { app };
