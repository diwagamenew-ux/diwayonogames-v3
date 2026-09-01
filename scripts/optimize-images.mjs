import sharp from "sharp";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const ROOT = "public/images";
const fmt = (b) => (b >= 1024 * 1024 ? (b / 1024 / 1024).toFixed(2) + " MB" : (b / 1024).toFixed(1) + " KB");

async function opt(file, { width, height, fit = "inside", palette = true, colors = 256 }) {
  const before = (await stat(file)).size;
  let pipe = sharp(file).rotate(); // auto-orient
  if (width || height) pipe = pipe.resize({ width, height, fit, withoutEnlargement: true });
  pipe = pipe.png({ compressionLevel: 9, effort: 10, palette, quality: 80, colors });
  await pipe.toFile(file + ".tmp");
  const after = (await stat(file + ".tmp")).size;
  await import("node:fs/promises").then((m) => m.rename(file + ".tmp", file));
  console.log(`  ${file.padEnd(38)} ${fmt(before).padStart(9)}  →  ${fmt(after).padStart(8)}   (-${Math.round((1 - after / before) * 100)}%)`);
}

console.log("Compressing logo + OG (kept as PNG for favicon/apple/OG compatibility):");
await opt(join(ROOT, "logo.png"), { width: 512, height: 512, fit: "inside" });
await opt(join(ROOT, "og-default.png"), { width: 1200, height: 630, fit: "cover", palette: true, colors: 256 });

console.log("\nCompressing game icons (next/image will serve WebP/AVIF at the edge):");
const games = await readdir(join(ROOT, "games"));
for (const f of games) {
  if (!f.toLowerCase().endsWith(".png")) continue;
  await opt(join(ROOT, "games", f), { width: 512, height: 512, fit: "inside" });
}
console.log("\nDone. Source PNGs are now small; next/image negotiates WebP/AVIF per request.");
