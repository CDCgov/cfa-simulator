import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Packages whose published types come from `vite-plugin-dts` (via `plz build`).
const PACKAGES = ["cfasim-ui/components", "cfasim-ui/charts"];

const root = resolve(import.meta.dirname, "..");

// Top-level `types` plus every `exports.*.types`.
function collectTypePaths(pkgJson) {
  const paths = new Set();
  if (typeof pkgJson.types === "string") paths.add(pkgJson.types);

  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (key === "types" && typeof value === "string") paths.add(value);
      else walk(value);
    }
  };
  walk(pkgJson.exports);

  return [...paths];
}

// Relative re-exports of an entry `.d.ts` whose declaration file is missing.
// vite-plugin-dts skips a component whose props interface is not exported
// (TS4025) and only logs it, so the entry then re-exports a file that is
// not there and consumers see the component as `any`.
function missingReExports(dtsPath) {
  const src = readFileSync(dtsPath, "utf8");
  const missing = [];
  for (const [, spec] of src.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
    const base = resolve(dirname(dtsPath), spec).replace(/\.[jt]s$/, "");
    const exists = [`${base}.d.ts`, `${base}/index.d.ts`, base].some(
      (f) => existsSync(f) && statSync(f).isFile(),
    );
    if (!exists) missing.push(spec);
  }
  return missing;
}

let failed = false;

console.log("\nPackage types check\n");

for (const pkgDir of PACKAGES) {
  const pkgPath = resolve(root, pkgDir, "package.json");
  const pkgJson = JSON.parse(readFileSync(pkgPath, "utf8"));
  const typePaths = collectTypePaths(pkgJson);

  if (typePaths.length === 0) {
    console.error(`✗ ${pkgJson.name}: no "types" entry points declared`);
    failed = true;
    continue;
  }

  for (const rel of typePaths) {
    const full = resolve(root, pkgDir, rel);
    const ok = existsSync(full) && statSync(full).size > 0;
    console.log(`${ok ? "✓" : "✗"} ${pkgJson.name}: ${rel}`);
    if (!ok) failed = true;
    if (ok) {
      for (const missing of missingReExports(full)) {
        console.log(
          `✗ ${pkgJson.name}: ${rel} re-exports ${missing}, not emitted`,
        );
        failed = true;
      }
    }
  }
}

console.log();

if (failed) {
  console.error(
    "Package types check failed: a declared types entry point or a file it " +
      "re-exports is missing (check the dist layout, tsconfig `rootDir`, or " +
      "an unexported props interface).",
  );
  process.exit(1);
}

console.log("All declared type entry points exist.");
