/**
 * Pre-build diagnostics for Vercel.
 * Usage:
 *   node ./build.mjs --check-only   (exit 1 if required files missing)
 *   node ./build.mjs                (check + run vite build)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
process.chdir(root);
const checkOnly = process.argv.includes("--check-only");

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

console.log("[build] node", process.version);
console.log("[build] cwd", root);
console.log("[build] VERCEL", process.env.VERCEL ?? "(not set)");
console.log("[build] CI", process.env.CI ?? "(not set)");

const required = [
  "package.json",
  "vite.config.ts",
  "src/router.tsx",
  "src/routes/__root.tsx",
  "src/routeTree.gen.ts",
];

let missing = false;
for (const f of required) {
  const ok = exists(f);
  console.log(`[build] ${ok ? "OK     " : "MISSING"} ${f}`);
  if (!ok) missing = true;
}

if (exists("src")) {
  const srcList = fs.readdirSync(path.join(root, "src"));
  console.log("[build] src/ contains:", srcList.join(", "));
  // Count files under src
  let count = 0;
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else count++;
    }
  };
  walk(path.join(root, "src"));
  console.log("[build] src file count:", count, "(expect ~90+)");
  if (count < 20) {
    console.error(
      "[build] FATAL: src folder looks incomplete on GitHub (too few files).",
    );
    missing = true;
  }
} else {
  console.error("[build] FATAL: no src/ directory");
  missing = true;
}

if (exists("node_modules/vite/package.json")) {
  console.log("[build] OK      node_modules/vite");
} else if (!checkOnly) {
  console.error("[build] FATAL: vite not installed");
  missing = true;
}

if (missing) {
  console.error(
    "[build] Fix: re-upload the full extracted zip so src has components, lib, routes (many files).",
  );
  process.exit(1);
}

if (checkOnly) {
  console.log("[build] prebuild checks passed");
  process.exit(0);
}

const viteJs = path.join(root, "node_modules", "vite", "bin", "vite.js");
console.log("[build] running vite build…");
const r = spawnSync(process.execPath, [viteJs, "build", "--logLevel", "info"], {
  cwd: root,
  env: {
    ...process.env,
    CI: "1",
    NODE_OPTIONS: [process.env.NODE_OPTIONS, "--max-old-space-size=6144"]
      .filter(Boolean)
      .join(" "),
  },
  stdio: "inherit",
});
if (r.error) {
  console.error("[build] spawn error", r.error);
  process.exit(1);
}
process.exit(r.status ?? 1);
