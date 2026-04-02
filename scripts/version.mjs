#!/usr/bin/env node

/**
 * Bumps the version of all publishable packages (cfasim-ui/* and Cargo crates).
 * Usage: node scripts/version.mjs <patch|minor|major>
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

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
  "cfasim-ui/cfasim-ui/package.json",
];

const CARGO_TOMLS = ["cfasim/Cargo.toml", "cfasim-model/Cargo.toml"];

const PYPROJECT_TOMLS = ["cfasim-model-py/pyproject.toml"];

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
  return content.version;
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

function bumpPyprojectToml(path) {
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

let newVersion;
for (const p of PACKAGE_JSONS) newVersion = bumpPackageJson(p);
for (const p of CARGO_TOMLS) bumpCargoToml(p);
for (const p of PYPROJECT_TOMLS) bumpPyprojectToml(p);

// Update Cargo.lock files to reflect the new versions
execSync("cargo check --workspace", { stdio: "inherit" });
const tag = `v${newVersion}`;
const allFiles = [
  ...PACKAGE_JSONS,
  ...CARGO_TOMLS,
  ...PYPROJECT_TOMLS,
  "Cargo.lock",
].join(" ");
execSync(`git add ${allFiles}`, { stdio: "inherit" });
execSync(`git commit -m "release: ${tag}"`, { stdio: "inherit" });
execSync(`git tag ${tag}`, { stdio: "inherit" });

console.log(`\nAll packages bumped (${BUMP}). Created commit and tag ${tag}.`);
