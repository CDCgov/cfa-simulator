import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { componentDocs } from "./generate_docs.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const DOCS_PACKAGES = ["components", "charts"] as const;

describe("bundled package docs generator", () => {
  it("produces a valid docs/index.json in each package and every referenced path exists", () => {
    execSync("node scripts/generate_docs.mjs", { cwd: ROOT, stdio: "pipe" });

    for (const pkg of DOCS_PACKAGES) {
      const pkgRoot = resolve(ROOT, "cfasim-ui", pkg);
      const index = JSON.parse(
        readFileSync(resolve(pkgRoot, "docs/index.json"), "utf-8"),
      );
      const entries = index.content[pkg];
      expect(entries.length).toBeGreaterThan(0);

      for (const entry of entries) {
        for (const field of ["docs", "source"] as const) {
          const path = resolve(pkgRoot, entry[field]);
          expect(
            existsSync(path),
            `${entry.name}.${field} missing: ${path}`,
          ).toBe(true);
        }
      }

      // The tarball must ship both the bundled docs and the raw source.
      const manifest = JSON.parse(
        readFileSync(resolve(pkgRoot, "package.json"), "utf-8"),
      );
      expect(manifest.files).toContain("docs");
      expect(manifest.files).toContain("src");
    }
  });
});

describe("docs overview page", () => {
  it("links every documented component", () => {
    const overview = readFileSync(
      resolve(ROOT, "docs/cfasim-ui/index.md"),
      "utf-8",
    );
    for (const { name, slug, outDir } of componentDocs) {
      expect(overview, `docs/cfasim-ui/index.md is missing ${name}`).toContain(
        `(./${outDir}/${slug})`,
      );
    }
  });
});
