#!/usr/bin/env node
/**
 * Local preflight for Motion Atlas. Terminal twin of the `/system` page.
 * Zero dependencies. Exit code is non-zero if a *required* check fails.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COMFYUI_URL = process.env.COMFYUI_URL || "http://127.0.0.1:8188";

const results = [];
const add = (name, ok, detail, required = true) =>
  results.push({ name, ok, detail, required });

function tryExec(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return null;
  }
}

// Node
const nodeMajor = Number(process.versions.node.split(".")[0]);
add("Node >= 20", nodeMajor >= 20, `found ${process.version}`);

// pnpm
const pnpm = tryExec("pnpm --version");
add("pnpm installed", Boolean(pnpm), pnpm ? `v${pnpm}` : "not found");

// ffmpeg (optional — only for the bundled demo mp4)
const ffmpeg = tryExec("ffmpeg -version");
add(
  "ffmpeg (optional)",
  Boolean(ffmpeg),
  ffmpeg ? ffmpeg.split("\n")[0] : "not found — demo falls back to synthetic clip",
  false,
);

// nvidia-smi (optional in demo mode)
const smi = tryExec(
  'nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits',
);
add(
  "nvidia-smi (real mode)",
  Boolean(smi),
  smi ? smi.replace(/\n/g, " | ") : "not found — fine for DEMO_MODE",
  false,
);

// ComfyUI reachable (optional in demo mode)
let comfy = false;
let comfyDetail = "";
try {
  const res = await fetch(`${COMFYUI_URL}/system_stats`, {
    signal: AbortSignal.timeout(1500),
  });
  comfy = res.ok;
  comfyDetail = `${COMFYUI_URL} → ${res.status}`;
} catch (err) {
  comfyDetail = `${COMFYUI_URL} → ${err.code || err.name || "unreachable"}`;
}
add("ComfyUI reachable (real mode)", comfy, comfyDetail, false);

// workflow templates
const t2v = existsSync(resolve(root, "comfy/workflows/wan22_t2v.json"));
add(
  "Workflow: wan22_t2v.json (real mode)",
  t2v,
  t2v ? "present" : "add it after exporting from ComfyUI",
  false,
);

// storage writable
const storageOk =
  existsSync(resolve(root, "storage/generations")) &&
  existsSync(resolve(root, "storage/uploads"));
add("storage/ directories", storageOk, storageOk ? "present" : "missing");

// ── report ──
let hardFail = false;
console.log("\n  Motion Atlas — system check\n  " + "─".repeat(40));
for (const r of results) {
  const mark = r.ok ? "[32m✓[0m" : r.required ? "[31m✗[0m" : "[33m•[0m";
  console.log(`  ${mark} ${r.name.padEnd(34)} ${r.detail}`);
  if (!r.ok && r.required) hardFail = true;
}
console.log("  " + "─".repeat(40));
console.log(
  hardFail
    ? "  [31mNOT READY[0m — fix the ✗ items above.\n"
    : "  [32mREADY[0m — demo mode works now; real mode needs the • items.\n",
);
process.exit(hardFail ? 1 : 0);
