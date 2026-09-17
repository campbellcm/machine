import { spawn } from "node:child_process";
// Polling also works on hosts with low filesystem watcher limits.
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", env: { ...process.env, WATCHPACK_POLLING: "true" } },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
