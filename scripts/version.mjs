#!/usr/bin/env node

/**
 * Bumps the version of all publishable packages (cfasim-ui/* and Cargo crates).
 * Usage: node scripts/version.mjs <patch|minor|major>
 */

import { readFileSync, writeFileSync } from "node:fs";

const BUMP = process.argv[2];
if (!["patch", "minor", "major"].includes(BUMP)) {
  console.error("Usage: node scripts/version.mjs <patch|minor|major>");
  process.exit(1);
}

const PACKAGE_JSONS = [
  "cfasim-ui/components/package.json",
  "cfasim-ui/charts/package.json",
  "cfasim-ui/theme/package.json",
  "cfasim-ui/wasm/package.json",
  "cfasim-ui/pyodide/package.json",
  "cfasim-ui/shared/package.json",
];

const CARGO_TOMLS = ["cfasim/Cargo.toml", "cfasim-model/Cargo.toml"];

function bump(version, type) {
  const [major, minor, patch] = version.split(".").map(Number);
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

function bumpPackageJson(path) {
  const content = JSON.parse(readFileSync(path, "utf8"));
  const old = content.version;
  content.version = bump(old, BUMP);
  writeFileSync(path, JSON.stringify(content, null, 2) + "\n");
  console.log(`${path}: ${old} → ${content.version}`);
}

function bumpCargoToml(path) {
  const content = readFileSync(path, "utf8");
  const match = content.match(/^version\s*=\s*"(\d+\.\d+\.\d+)"/m);
  if (!match) {
    console.error(`Could not find version in ${path}`);
    process.exit(1);
  }
  const old = match[1];
  const next = bump(old, BUMP);
  const updated = content.replace(
    /^(version\s*=\s*")(\d+\.\d+\.\d+)(")/m,
    `$1${next}$3`,
  );
  writeFileSync(path, updated);
  console.log(`${path}: ${old} → ${next}`);
}

for (const p of PACKAGE_JSONS) bumpPackageJson(p);
for (const p of CARGO_TOMLS) bumpCargoToml(p);

console.log(`\nAll packages bumped (${BUMP}).`);
