/**
 * Railway start for Next.js standalone output.
 */
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const port = process.env.PORT || "3000";
process.env.PORT = port;
process.env.HOSTNAME = "0.0.0.0";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "file:/data/holovault.db";

console.log("[entrypoint] PORT=", port);
console.log("[entrypoint] DATABASE_URL=", process.env.DATABASE_URL);

try {
  fs.mkdirSync("/data", { recursive: true });
  try {
    fs.chmodSync("/data", 0o777);
  } catch {
    /* ignore */
  }
} catch (e) {
  console.warn("[entrypoint] mkdir /data:", e.message);
}

console.log("[entrypoint] prisma db push...");
try {
  execSync("npx prisma db push --skip-generate", {
    stdio: "inherit",
    env: process.env,
    cwd: "/app",
  });
} catch {
  console.warn("[entrypoint] prisma push failed, retry...");
  try {
    execSync("npx prisma db push --skip-generate", {
      stdio: "inherit",
      env: process.env,
      cwd: "/app",
    });
  } catch (e2) {
    console.error("[entrypoint] prisma push still failing:", e2.message);
  }
}

// Standalone server entry
const serverJs = path.join("/app", "server.js");
console.log("[entrypoint] starting", serverJs, "on", port);
const child = spawn("node", [serverJs], {
  stdio: "inherit",
  env: process.env,
  cwd: "/app",
});

child.on("exit", (code) => process.exit(code ?? 1));
