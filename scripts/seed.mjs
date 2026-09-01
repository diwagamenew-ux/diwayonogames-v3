// Seed script — thin wrapper around the canonical TypeScript seed in src/db/seed.ts.
// Usage: node scripts/seed.mjs   (wipes all tables and re-seeds demo content)
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tsx = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");

const result = spawnSync(process.execPath, [tsx, "src/db/reseed.ts"], {
  stdio: "inherit",
  env: process.env,
  cwd: root,
});
process.exit(result.status ?? 1);
