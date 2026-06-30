import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);

const DEFAULT_IMAGE_REPOSITORY = "ghcr.io/r-wasm/webr";
const CFASIM_PACKAGE_NAME = "cfasim";
const CFASIM_PACKAGE_MOUNT = "/cfasim-package";
const DEFAULT_RWASM_PACKAGE_REF = "r-wasm/rwasm";
const WEBR_R_DESCRIPTION =
  "dist/vfs/usr/lib/R/library/translations/DESCRIPTION";
const WEBR_DIST_DIR = "dist";
const DEFAULT_CFASIM_PACKAGE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../r/cfasim",
);

let webRPackageInfo;

function normalizeName(name) {
  return name.replace(/-/g, "_");
}

function resolveEntry(modelDir, entry) {
  if (entry) return entry;
  if (existsSync(resolve(modelDir, "R", "model.R"))) return "R/model.R";
  return "model.R";
}

function dockerOptions(options) {
  if (typeof options?.docker === "object") return options.docker;
  return {};
}

function rVector(items) {
  return `c(${items.map((pkg) => `"${pkg}"`).join(", ")})`;
}

function rString(value) {
  return JSON.stringify(value);
}

function findPackageRoot(packageName) {
  let current = dirname(require.resolve(packageName));
  while (current !== dirname(current)) {
    const packagePath = join(current, "package.json");
    if (existsSync(packagePath)) {
      const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
      if (packageJson.name === packageName) {
        return { packageJson, packageRoot: current };
      }
    }
    current = dirname(current);
  }
  throw new Error(`Unable to locate ${packageName} package root`);
}

function readWebRPackageInfo() {
  if (webRPackageInfo) return webRPackageInfo;

  const { packageJson, packageRoot } = findPackageRoot("webr");
  const descriptionPath = join(packageRoot, WEBR_R_DESCRIPTION);
  const description = readFileSync(descriptionPath, "utf-8");
  const rVersion = description.match(/^Version:\s*(\d+)\.(\d+)(?:\.\d+)?\s*$/m);
  if (!rVersion) {
    throw new Error(`Unable to detect webR R version from ${descriptionPath}`);
  }

  webRPackageInfo = {
    packageVersion: packageJson.version,
    binaryVersion: `${rVersion[1]}.${rVersion[2]}`,
    packageRoot,
  };
  return webRPackageInfo;
}

function defaultDockerImage() {
  return `${DEFAULT_IMAGE_REPOSITORY}:v${readWebRPackageInfo().packageVersion}`;
}

function hostOwnership() {
  if (
    typeof process.getuid !== "function" ||
    typeof process.getgid !== "function"
  ) {
    return undefined;
  }
  return { uid: process.getuid(), gid: process.getgid() };
}

export function dockerCommand({
  modelDir,
  outDir,
  cfasimPackageDir,
  modelPackage,
  packages,
  binaryVersion,
  rwasmPackage = DEFAULT_RWASM_PACKAGE_REF,
  docker,
}) {
  const image = docker.image ?? defaultDockerImage();
  const externalPackages = packages.filter(
    (pkg) => pkg !== CFASIM_PACKAGE_NAME && pkg !== modelPackage,
  );
  const buildExternal =
    externalPackages.length > 0
      ? [
          `rwasm::build(${rVector(externalPackages)}, out_dir = bin, dependencies = NA)`,
        ]
      : [];
  const buildModel = modelPackage
    ? [`rwasm::build("/model", out_dir = bin, dependencies = FALSE)`]
    : [];
  const rCommand =
    docker.rCommand ??
    [
      `pak::pkg_install(${rString(rwasmPackage)}, upgrade = FALSE)`,
      `pak::pkg_install("${CFASIM_PACKAGE_MOUNT}")`,
      `rv <- getRversion()`,
      `r_minor <- strsplit(as.character(rv$minor), ".", fixed = TRUE)[[1]][1]`,
      `r_binary <- paste(rv$major, r_minor, sep = ".")`,
      `expected_binary <- ${rString(binaryVersion)}`,
      `if (!identical(r_binary, expected_binary)) stop(sprintf("webR Docker image builds R %s packages, but installed webR runtime expects R %s packages", r_binary, expected_binary))`,
      `bin <- file.path("/output/repo/bin/emscripten/contrib", expected_binary)`,
      `dir.create(bin, recursive = TRUE, showWarnings = FALSE)`,
      `dir.create("/output/repo/src/contrib", recursive = TRUE, showWarnings = FALSE)`,
      `rwasm::build("${CFASIM_PACKAGE_MOUNT}", out_dir = bin, dependencies = FALSE)`,
      ...buildExternal,
      ...buildModel,
      `file.copy(list.files(bin, pattern = "\\\\.tgz$", full.names = TRUE), "/output/repo/src/contrib", overwrite = TRUE)`,
      `rwasm::write_packages("/output/repo")`,
      `file.copy(list.files(bin, pattern = "^PACKAGES(\\\\.gz|\\\\.rds)?$", full.names = TRUE), "/output/repo/src/contrib", overwrite = TRUE)`,
    ].join("; ");
  const mounts = cfasimPackageDir
    ? ["-v", `${cfasimPackageDir}:${CFASIM_PACKAGE_MOUNT}:ro`]
    : [];
  const ownership = hostOwnership();
  const user = ownership ? ["--user", `${ownership.uid}:${ownership.gid}`] : [];

  return {
    file: "docker",
    args: [
      "run",
      "--rm",
      ...user,
      "-e",
      "HOME=/tmp",
      "-v",
      `${modelDir}:/model:ro`,
      ...mounts,
      "-v",
      `${outDir}:/output`,
      "-w",
      "/output",
      image,
      "R",
      "-q",
      "-e",
      rCommand,
    ],
  };
}

function describeDockerFailure(error) {
  if (error?.code === "ENOENT") {
    return (
      "Docker is required to build R model packages, but the `docker` command " +
      "was not found. Install Docker (https://docs.docker.com/get-docker/), or " +
      "pass `docker: false` to cfasimRwasm() to use a prebuilt package repo."
    );
  }
  // execFileSync surfaces the child's output on stderr/stdout, not in the
  // default "Command failed" message — fold it in so the R/Docker error shows.
  const detail = [error?.stderr, error?.stdout]
    .map((buf) => buf?.toString().trim())
    .find(Boolean);
  const base = "R package build failed while running Docker";
  return detail ? `${base}:\n${detail}` : `${base}: ${error?.message ?? error}`;
}

function shouldRunDocker(
  outDir,
  packages,
  binaryVersion,
  docker,
  cachePath,
  cacheKey,
) {
  if (packages.length === 0) return false;
  const rebuild = docker.rebuild ?? "auto";
  if (rebuild === "always") return true;
  if (rebuild === "never") return false;
  return (
    !repoHasBinaryPackages(join(outDir, "repo"), packages, binaryVersion) ||
    readBuildCacheKey(cachePath) !== cacheKey
  );
}

function readPackageIndexes(repoDir) {
  if (!existsSync(repoDir)) return [];
  const indexes = [];
  for (const entry of readdirSync(repoDir)) {
    const path = join(repoDir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) indexes.push(...readPackageIndexes(path));
    if (stat.isFile() && entry === "PACKAGES") {
      indexes.push(readFileSync(path, "utf-8"));
    }
  }
  return indexes;
}

function repoHasPackages(repoDir, packages) {
  const indexes = readPackageIndexes(repoDir).join("\n");
  return packages.every((pkg) =>
    new RegExp(
      `^Package:\\s*${pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      "m",
    ).test(indexes),
  );
}

function repoHasBinaryPackages(repoDir, packages, binaryVersion) {
  const expectedRepo = join(
    repoDir,
    "bin",
    "emscripten",
    "contrib",
    binaryVersion,
  );
  return existsSync(expectedRepo) && repoHasPackages(expectedRepo, packages);
}

function isWithin(path, dir) {
  const rel = relative(dir, path);
  return rel === "" || (!!rel && !rel.startsWith("..") && !isAbsolute(rel));
}

function copyModel(modelDir, outDir, excludePaths = []) {
  const target = join(outDir, "model");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  const modelRoot = resolve(modelDir);
  const copyTarget = isWithin(target, modelRoot)
    ? join(mkdtempSync(join(tmpdir(), "cfasim-rwasm-model-")), "model")
    : target;
  const ignoredNames = new Set([".git", "dist", "node_modules"]);
  const excluded = [target, ...excludePaths]
    .map((path) => resolve(path))
    .filter((path) => path !== modelRoot && isWithin(path, modelRoot));

  cpSync(modelDir, copyTarget, {
    recursive: true,
    filter(src) {
      const resolved = resolve(src);
      if (resolved !== modelRoot && ignoredNames.has(basename(resolved))) {
        return false;
      }
      return !excluded.some((path) => isWithin(resolved, path));
    },
  });
  if (copyTarget !== target) {
    cpSync(copyTarget, target, { recursive: true });
    rmSync(dirname(copyTarget), { recursive: true, force: true });
  }
  return target;
}

function uniquePackages(packages) {
  return Array.from(new Set(packages.filter(Boolean)));
}

function readDescriptionFields(modelDir) {
  const descriptionPath = resolve(modelDir, "DESCRIPTION");
  if (!existsSync(descriptionPath)) return new Map();

  const fields = new Map();
  let current;
  for (const line of readFileSync(descriptionPath, "utf-8").split(/\r?\n/)) {
    const field = line.match(/^([^:\s][^:]*):\s*(.*)$/);
    if (field) {
      current = field[1].trim();
      fields.set(current, field[2].trim());
      continue;
    }
    if (current && /^[ \t]/.test(line)) {
      fields.set(current, `${fields.get(current)}\n${line.trim()}`.trim());
    }
  }
  return fields;
}

function readDescriptionPackageName(modelDir) {
  return readDescriptionFields(modelDir).get("Package");
}

function readDescriptionPackages(modelDir) {
  const fields = readDescriptionFields(modelDir);
  return ["Imports", "Depends"].flatMap((field) =>
    (fields.get(field) ?? "")
      .split(",")
      .map((pkg) => pkg.trim().replace(/\s*\(.+\)$/, ""))
      .filter((pkg) => pkg && pkg !== "R"),
  );
}

function hashString(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashDirectory(dir) {
  const hash = createHash("sha256");
  const root = resolve(dir);

  function visit(path) {
    const stat = statSync(path);
    const rel = relative(root, path);
    if (stat.isDirectory()) {
      hash.update(`dir:${rel}\0`);
      for (const entry of readdirSync(path).sort()) {
        visit(join(path, entry));
      }
      return;
    }
    if (stat.isFile()) {
      hash.update(`file:${rel}\0`);
      hash.update(readFileSync(path));
    }
  }

  visit(root);
  return hash.digest("hex");
}

function readBuildCacheKey(cachePath) {
  try {
    return JSON.parse(readFileSync(cachePath, "utf-8")).key;
  } catch {
    return undefined;
  }
}

function writeBuildCacheKey(cachePath, key) {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, `${JSON.stringify({ key }, null, 2)}\n`);
}

function buildCacheKey({
  stagedModelDir,
  cfasimPackageDir,
  packages,
  binaryVersion,
  rwasmPackage,
  dockerImage,
  entry,
  modelPackage,
}) {
  return hashString(
    JSON.stringify({
      version: 1,
      modelHash: hashDirectory(stagedModelDir),
      cfasimPackageHash: hashDirectory(cfasimPackageDir),
      packages,
      binaryVersion,
      rwasmPackage,
      dockerImage,
      entry,
      modelPackage,
    }),
  );
}

function buildCachePath(root, name) {
  return resolve(
    root,
    "node_modules",
    ".cache",
    "cfasim-rwasm",
    `${name}.json`,
  );
}

function writeManifest({
  outDir,
  name,
  entry,
  modelPackage,
  packages,
  webRBaseUrl,
}) {
  const manifest = {
    name,
    entry,
    modelPackage,
    modelBaseUrl: `rwasm/${name}/model/`,
    packages,
    repoUrl: packages.length > 0 ? `rwasm/${name}/repo/` : undefined,
    webRBaseUrl,
    createdBy: "cfasimRwasm",
  };
  writeFileSync(
    join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

function ensureHostedWebRAssets(root) {
  const { packageVersion, packageRoot } = readWebRPackageInfo();
  const target = resolve(root, "public", "rwasm", "webr", `v${packageVersion}`);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(packageRoot, WEBR_DIST_DIR), target, { recursive: true });
  return `rwasm/webr/v${packageVersion}/`;
}

export function buildRwasmBundle(root, options = {}) {
  const modelDir = resolve(root, options.model ?? "model");
  if (!existsSync(modelDir))
    throw new Error(`R model directory not found: ${modelDir}`);

  const name = normalizeName(options.name ?? basename(root));
  const entry = resolveEntry(modelDir, options.entry);
  const entryPath = resolve(modelDir, entry);
  if (!existsSync(entryPath))
    throw new Error(`R model entry not found: ${entryPath}`);

  const outDir = resolve(root, "public", "rwasm", name);
  mkdirSync(outDir, { recursive: true });
  rmSync(join(outDir, ".cfasim-rwasm-build.json"), { force: true });
  const stagedModelDir = copyModel(modelDir, outDir, [root]);

  const cfasimPackageDir = resolve(
    root,
    options.cfasimPackage ?? DEFAULT_CFASIM_PACKAGE_DIR,
  );
  if (!existsSync(cfasimPackageDir)) {
    throw new Error(
      `cfasim R package directory not found: ${cfasimPackageDir}`,
    );
  }

  const modelPackage =
    options.modelPackage ?? readDescriptionPackageName(modelDir);
  const packages = uniquePackages([
    CFASIM_PACKAGE_NAME,
    modelPackage,
    ...(options.packages ?? readDescriptionPackages(modelDir)),
  ]);
  const binaryVersion =
    options.webRBinaryVersion ?? readWebRPackageInfo().binaryVersion;

  const docker =
    options.docker === false ? { rebuild: "never" } : dockerOptions(options);
  const rwasmPackage = docker.rwasmPackage ?? DEFAULT_RWASM_PACKAGE_REF;
  const cachePath = buildCachePath(root, name);
  const cacheKey = buildCacheKey({
    stagedModelDir,
    cfasimPackageDir,
    packages,
    binaryVersion,
    rwasmPackage,
    dockerImage: docker.image ?? defaultDockerImage(),
    entry,
    modelPackage,
  });

  const dockerRan = shouldRunDocker(
    outDir,
    packages,
    binaryVersion,
    docker,
    cachePath,
    cacheKey,
  );
  if (dockerRan) {
    const command = dockerCommand({
      modelDir: stagedModelDir,
      outDir,
      cfasimPackageDir,
      modelPackage,
      packages,
      binaryVersion,
      rwasmPackage,
      docker,
    });
    try {
      execFileSync(command.file, command.args, { cwd: root, stdio: "pipe" });
    } catch (error) {
      throw new Error(describeDockerFailure(error), { cause: error });
    }
  }

  if (
    packages.length > 0 &&
    !repoHasBinaryPackages(join(outDir, "repo"), packages, binaryVersion)
  ) {
    throw new Error(
      `R package assets missing for webR R ${binaryVersion}: ${join(outDir, "repo")}`,
    );
  }
  if (docker.rebuild !== "never") {
    writeBuildCacheKey(cachePath, cacheKey);
  }

  writeManifest({
    outDir,
    name,
    entry,
    modelPackage,
    packages,
    webRBaseUrl: options.webRBaseUrl ?? ensureHostedWebRAssets(root),
  });
}

export function cfasimRwasm(options) {
  return {
    name: "cfasim-rwasm",
    configResolved(config) {
      buildRwasmBundle(config.root, options);
    },
  };
}
