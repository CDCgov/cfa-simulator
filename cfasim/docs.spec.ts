import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const CLI = resolve(ROOT, "target/debug/cfasim");
const DOCS_PKG = resolve(ROOT, "cfasim-ui/docs");

type Entry = { name: string; slug: string; docs: string; source: string };

test.describe("cfasim docs --json against an installed @cfasim-ui/docs", () => {
  let tmpRoot: string;
  let consumerDir: string;

  test.beforeAll(() => {
    execSync("cargo build -p cfasim", { cwd: ROOT });

    tmpRoot = mkdtempSync(resolve(tmpdir(), "cfasim-docs-e2e-"));
    const tarballDir = resolve(tmpRoot, "tarballs");
    mkdirSync(tarballDir);

    // `pnpm pack` runs the `prepack` script (generator) first, then tars up
    // whatever the `files` field in package.json declares.
    execSync(`pnpm pack --pack-destination ${tarballDir}`, { cwd: DOCS_PKG });
    const tgz = readdirSync(tarballDir).find((f) => f.endsWith(".tgz"));
    if (!tgz) throw new Error("pnpm pack produced no tarball");
    const tarballPath = resolve(tarballDir, tgz);

    // Standalone consumer project outside the workspace tree.
    consumerDir = resolve(tmpRoot, "consumer");
    mkdirSync(consumerDir);
    writeFileSync(
      resolve(consumerDir, "package.json"),
      JSON.stringify({
        name: "cfasim-docs-consumer",
        private: true,
        dependencies: { "@cfasim-ui/docs": `file:${tarballPath}` },
      }),
    );
    execSync("pnpm install --ignore-workspace", { cwd: consumerDir });
  });

  test.afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  test("every docs and source path resolves to a real file", () => {
    const raw = execSync(`${CLI} docs --json`, { cwd: consumerDir }).toString();
    const parsed = JSON.parse(raw);
    const entries: Entry[] = [
      ...parsed.content.components,
      ...parsed.content.charts,
    ];
    expect(entries.length).toBeGreaterThan(0);

    const missing: string[] = [];
    for (const entry of entries) {
      for (const field of ["docs", "source"] as const) {
        const path = entry[field];
        expect(
          path.startsWith("/"),
          `${entry.name}.${field} not absolute: ${path}`,
        ).toBe(true);
        if (!existsSync(path) || !statSync(path).isFile()) {
          missing.push(`${entry.name}.${field} -> ${path}`);
        }
      }
    }
    expect(missing, `missing files:\n${missing.join("\n")}`).toEqual([]);
  });
});
