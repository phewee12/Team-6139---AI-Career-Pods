import { spawn } from "node:child_process";
import dotenv from "dotenv";

const [, , envPath, command, ...args] = process.argv;

if (!envPath || !command) {
  console.error("Usage: node scripts/runWithEnv.js <envPath> <command> [args...]");
  process.exit(1);
}

dotenv.config({ path: envPath, override: true });

const child = spawn(command, args, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
