#!/usr/bin/env node
/**
 * Optional: render a short bundled demo MP4 so the demo player shows a real
 * <video> instead of the in-browser synthetic clip.
 *
 * Requires ffmpeg on PATH. Safe to skip entirely.
 */
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "apps/web/public/demo");
const out = resolve(outDir, "atlas-demo.mp4");

try {
  execSync("ffmpeg -version", { stdio: "ignore" });
} catch {
  console.error("ffmpeg not found on PATH — nothing to do. The demo UI will use the synthetic clip.");
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });

// 3s, 640x384, 16fps: drifting gradient + noise + vignette. ~cinematic placeholder.
const filter = [
  "gradients=s=640x384:c0=0x0b1020:c1=0x241a3a:x0=0:y0=0:x1=640:y1=384:nb_colors=3:speed=0.02",
  "noise=alls=8:allf=t",
  "vignette=PI/4",
  "format=yuv420p",
].join(",");

const cmd =
  `ffmpeg -y -f lavfi -i "${filter}" -t 3 -r 16 ` +
  `-c:v libx264 -pix_fmt yuv420p -movflags +faststart "${out}"`;

console.log("→", cmd);
execSync(cmd, { stdio: "inherit" });
console.log("\nWrote", out);
console.log('Set NEXT_PUBLIC_HAS_DEMO_VIDEO=true in apps/web/.env.local to use it.');
