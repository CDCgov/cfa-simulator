import { readFileSync, statSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const KB = 1024;

// Size limits in bytes (gzipped for JS, raw for CSS)
const LIMITS = [
  {
    name: "@cfasim-ui/components JS",
    path: "cfasim-ui/components/dist/index.js",
    gzip: true,
    limit: 10 * KB,
  },
  {
    name: "@cfasim-ui/components CSS",
    path: "cfasim-ui/components/dist/index.css",
    gzip: false,
    limit: 20 * KB,
  },
  {
    name: "@cfasim-ui/charts JS",
    path: "cfasim-ui/charts/dist/index.js",
    gzip: true,
    limit: 50 * KB,
  },
  {
    name: "@cfasim-ui/charts CSS",
    path: "cfasim-ui/charts/dist/index.css",
    gzip: false,
    limit: 5 * KB,
  },
  {
    name: "@cfasim-ui/theme (all CSS)",
    path: "cfasim-ui/theme/src",
    dir: true,
    gzip: false,
    limit: 20 * KB,
  },
];

function getFileSize(filePath) {
  return statSync(filePath).size;
}

function getGzipSize(filePath) {
  return gzipSync(readFileSync(filePath)).length;
}

function getDirCssSize(dirPath) {
  let total = 0;
  for (const entry of readdirSync(dirPath, {
    withFileTypes: true,
    recursive: true,
  })) {
    if (entry.isFile() && entry.name.endsWith(".css")) {
      total += getFileSize(resolve(entry.parentPath, entry.name));
    }
  }
  return total;
}

function formatSize(bytes) {
  if (bytes < KB) return `${bytes} B`;
  return `${(bytes / KB).toFixed(1)} KB`;
}

const root = resolve(import.meta.dirname, "..");
let failed = false;

console.log("\nBundle size check\n");

for (const entry of LIMITS) {
  const fullPath = resolve(root, entry.path);
  let size;

  if (entry.dir) {
    size = getDirCssSize(fullPath);
  } else if (entry.gzip) {
    size = getGzipSize(fullPath);
  } else {
    size = getFileSize(fullPath);
  }

  const label = entry.gzip ? "gzip" : "raw";
  const ok = size <= entry.limit;
  const icon = ok ? "✓" : "✗";

  console.log(
    `${icon} ${entry.name}: ${formatSize(size)} ${label} (limit: ${formatSize(entry.limit)})`,
  );

  if (!ok) failed = true;
}

console.log();

if (failed) {
  console.error(
    "Bundle size check failed — one or more packages exceeded limits.",
  );
  process.exit(1);
}

console.log("All packages within size limits.");
