/**
 * Railway / Docker start script (Node so Windows CRLF can't break the container).
 */
const { execSync, spawn } = require("child_process");
const fs = require("fs");

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
  });
} catch {
  console.warn("[entrypoint] first prisma push failed, retry...");
  try {
    execSync("npx prisma db push --skip-generate", {
      stdio: "inherit",
      env: process.env,
    });
  } catch (e2) {
    console.error("[entrypoint] prisma push failed:", e2.message);
    // still start — some deploys recover on next request
  }
}

console.log("[entrypoint] next start -H 0.0.0.0 -p", port);
const child = spawn(
  "npx",
  ["next", "start", "-H", "0.0.0.0", "-p", port],
  { stdio: "inherit", env: process.env, shell: true }
);

child.on("exit", (code) => process.exit(code ?? 1));
