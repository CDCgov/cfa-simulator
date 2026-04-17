#!/usr/bin/env node

/**
 * Two-step release flow:
 *   1. `node scripts/version.mjs <patch|minor|major>`
 *        Bumps versions across npm/cargo/pypi packages, refreshes Cargo.lock,
 *        and prepends a new section to CHANGELOG.md for the unreleased
 *        commits since the latest tag. Past sections are left untouched so
 *        manual edits survive. Leaves everything unstaged so you can review
 *        and edit before committing.
 *   2. `node scripts/version.mjs commit`
 *        Stages the changed files, creates the `release: vX.Y.Z` commit,
 *        and tags it.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const VALID_BUMPS = ["patch", "minor", "major"];

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

const TRACKED_FILES = [
  ...PACKAGE_JSONS,
  ...CARGO_TOMLS,
  ...PYPROJECT_TOMLS,
  "Cargo.lock",
  "models/src/reed-frost/model/Cargo.lock",
  "CHANGELOG.md",
];

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

function bumpPackageJson(path, type) {
  const content = JSON.parse(readFileSync(path, "utf8"));
  const old = content.version;
  content.version = bump(old, type);
  writeFileSync(path, JSON.stringify(content, null, 2) + "\n");
  console.log(`${path}: ${old} → ${content.version}`);
  return content.version;
}

function bumpTomlLike(path, type) {
  const content = readFileSync(path, "utf8");
  const match = content.match(/^version\s*=\s*"(\d+\.\d+\.\d+)"/m);
  if (!match) {
    console.error(`Could not find version in ${path}`);
    process.exit(1);
  }
  const old = match[1];
  const next = bump(old, type);
  const updated = content.replace(
    /^(version\s*=\s*")(\d+\.\d+\.\d+)(")/m,
    `$1${next}$3`,
  );
  writeFileSync(path, updated);
  console.log(`${path}: ${old} → ${next}`);
}

function readNpmVersion(path) {
  return JSON.parse(readFileSync(path, "utf8")).version;
}

function bumpAll(type) {
  let newVersion;
  for (const p of PACKAGE_JSONS) newVersion = bumpPackageJson(p, type);
  for (const p of CARGO_TOMLS) bumpTomlLike(p, type);
  for (const p of PYPROJECT_TOMLS) bumpTomlLike(p, type);

  execSync("cargo check --workspace", { stdio: "inherit" });
  execSync(
    "cargo check --manifest-path models/src/reed-frost/model/Cargo.toml",
    { stdio: "inherit" },
  );

  const tag = `v${newVersion}`;
  if (
    existsSync("CHANGELOG.md") &&
    readFileSync("CHANGELOG.md", "utf8").includes(`## [${newVersion}]`)
  ) {
    console.error(
      `\nCHANGELOG.md already has a [${newVersion}] section. Revert it before re-running this script.`,
    );
    process.exit(1);
  }
  try {
    execSync(`git cliff --unreleased --tag ${tag} --prepend CHANGELOG.md`, {
      stdio: "inherit",
    });
  } catch {
    console.error(
      "\nFailed to run git-cliff. Install it with `cargo install git-cliff` (or see `plz setup`).",
    );
    process.exit(1);
  }

  console.log(
    `\nBumped to ${tag}. Review CHANGELOG.md (and any other files), then run:\n` +
      `  plz commit`,
  );
}

function commitAndTag() {
  const version = readNpmVersion(PACKAGE_JSONS[0]);
  const tag = `v${version}`;

  const files = TRACKED_FILES.filter((f) => existsSync(f));
  execSync(`git add ${files.join(" ")}`, { stdio: "inherit" });
  execSync(`git commit -m "release: ${tag}"`, { stdio: "inherit" });
  execSync(`git tag ${tag}`, { stdio: "inherit" });

  console.log(`\nCreated commit and tag ${tag}.`);
}

const MODE = process.argv[2];
if (MODE === "commit") {
  commitAndTag();
} else if (VALID_BUMPS.includes(MODE)) {
  bumpAll(MODE);
} else {
  console.error(
    "Usage:\n" +
      "  node scripts/version.mjs <patch|minor|major>  # bump + changelog\n" +
      "  node scripts/version.mjs commit               # commit + tag",
  );
  process.exit(1);
}
