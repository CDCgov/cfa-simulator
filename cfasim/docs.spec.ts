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
const UI_PACKAGES = ["components", "charts"];

type Entry = { name: string; slug: string; docs: string; source: string };

test.describe("cfasim docs --json against installed @cfasim-ui packages", () => {
  let tmpRoot: string;
  let consumerDir: string;

  test.beforeAll(() => {
    execSync("cargo build -p cfasim", { cwd: ROOT });

    tmpRoot = mkdtempSync(resolve(tmpdir(), "cfasim-docs-e2e-"));
    const tarballDir = resolve(tmpRoot, "tarballs");
    mkdirSync(tarballDir);

    // `pnpm pack` runs the `prepack` script (docs generator) first, then tars
    // up whatever the `files` field in package.json declares.
    const overrides: Record<string, string> = {};
    for (const pkg of UI_PACKAGES) {
      execSync(`pnpm pack --pack-destination ${tarballDir}`, {
        cwd: resolve(ROOT, "cfasim-ui", pkg),
      });
      const tgz = readdirSync(tarballDir).find(
        (f) => f.startsWith(`cfasim-ui-${pkg}-`) && f.endsWith(".tgz"),
      );
      if (!tgz) throw new Error(`pnpm pack produced no tarball for ${pkg}`);
      overrides[`@cfasim-ui/${pkg}`] = `file:${resolve(tarballDir, tgz)}`;
    }
    // The umbrella's remaining workspace deps aren't under test; link them to
    // the local working tree since the workspace version may not be published.
    for (const pkg of ["shared", "wasm", "pyodide", "theme"]) {
      overrides[`@cfasim-ui/${pkg}`] =
        `file:${resolve(ROOT, "cfasim-ui", pkg)}`;
    }

    // Standalone consumer shaped like a scaffolded project: only the
    // cfasim-ui umbrella is a direct dependency, so the @cfasim-ui/* packages
    // live in pnpm's virtual store, not the root node_modules — the CLI must
    // resolve them through the umbrella.
    consumerDir = resolve(tmpRoot, "consumer");
    mkdirSync(consumerDir);
    writeFileSync(
      resolve(consumerDir, "package.json"),
      JSON.stringify({
        name: "cfasim-docs-consumer",
        private: true,
        dependencies: {
          "cfasim-ui": `file:${resolve(ROOT, "cfasim-ui/cfasim-ui")}`,
          vue: "^3.5.35",
        },
      }),
    );
    writeFileSync(
      resolve(consumerDir, "pnpm-workspace.yaml"),
      // nodeLinker pinned: a machine-global node-linker=hoisted would flatten
      // node_modules and mask the virtual-store resolution path this consumer
      // exists to test.
      "nodeLinker: isolated\noverrides:\n" +
        Object.entries(overrides)
          .map(([name, spec]) => `  "${name}": "${spec}"\n`)
          .join(""),
    );
    execSync("pnpm install", { cwd: consumerDir });
  });

  test.afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  test("every docs and source path resolves to a real file", () => {
    // The layout under test: transitive deps must NOT be at the root.
    expect(
      existsSync(resolve(consumerDir, "node_modules/@cfasim-ui")),
      "consumer should only depend on the umbrella; direct @cfasim-ui deps would mask the virtual-store resolution path",
    ).toBe(false);

    const raw = execSync(`${CLI} docs --json`, { cwd: consumerDir }).toString();
    const parsed = JSON.parse(raw);
    expect(parsed.content.components.length).toBeGreaterThan(0);
    expect(parsed.content.charts.length).toBeGreaterThan(0);
    const entries: Entry[] = [
      ...parsed.content.components,
      ...parsed.content.charts,
    ];

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

    // Unit/e2e test files must not ship in the tarballs.
    const testFile = entries[0].source.replace(/\.vue$/, ".test.ts");
    expect(existsSync(testFile), `${testFile} should not ship`).toBe(false);
  });
});
