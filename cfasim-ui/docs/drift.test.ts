import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const PACKAGE_ROOT = resolve(ROOT, "cfasim-ui/docs");

describe("@cfasim-ui/docs generator", () => {
  it("produces a valid index.json and every referenced path exists", () => {
    execSync("node scripts/generate_docs.mjs", { cwd: ROOT, stdio: "pipe" });

    const index = JSON.parse(
      readFileSync(resolve(PACKAGE_ROOT, "index.json"), "utf-8"),
    );
    const entries = [...index.content.components, ...index.content.charts];
    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      for (const field of ["docs", "source"] as const) {
        const path = resolve(PACKAGE_ROOT, entry[field]);
        expect(
          existsSync(path),
          `${entry.name}.${field} missing: ${path}`,
        ).toBe(true);
      }
    }
  });
});
