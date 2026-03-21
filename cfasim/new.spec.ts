import { test, expect } from "@playwright/test";
import { execSync, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const CLI = resolve(ROOT, "target/debug/cfasim");

type Model = "python" | "rust";

function cleanProject(name: string) {
  const dir = resolve(ROOT, name);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  // Remove entry from pnpm-workspace.yaml
  const wsFile = resolve(ROOT, "pnpm-workspace.yaml");
  const content = readFileSync(wsFile, "utf-8");
  const cleaned = content
    .split("\n")
    .filter((line) => !line.includes(`"${name}"`))
    .join("\n");
  if (cleaned !== content) {
    writeFileSync(wsFile, cleaned);
  }
}

function scaffoldProject(name: string, model: Model) {
  cleanProject(name);
  execSync(`${CLI} new --name ${name} --model ${model}`, { cwd: ROOT });
}

function startVite(
  name: string,
  port: number,
): { proc: ChildProcess; url: string } {
  const dir = resolve(ROOT, name);
  const proc = spawn("pnpm", ["exec", "vite", "--port", String(port)], {
    cwd: dir,
    stdio: "pipe",
  });
  return { proc, url: `http://localhost:${port}` };
}

async function waitForServer(url: string, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

test.describe("cfasim new", () => {
  const projects: { name: string; model: Model; port: number }[] = [
    { name: "test-project-python", model: "python", port: 7201 },
    { name: "test-project-rust", model: "rust", port: 7202 },
  ];

  const procs: ChildProcess[] = [];

  test.beforeAll(async () => {
    // Build CLI
    execSync("cargo build -p cfasim", { cwd: ROOT });

    // Scaffold all projects
    for (const p of projects) {
      scaffoldProject(p.name, p.model);
    }

    // Install dependencies
    execSync("pnpm install", { cwd: ROOT });

    // Start vite dev servers
    for (const p of projects) {
      const { proc, url } = startVite(p.name, p.port);
      procs.push(proc);
      await waitForServer(url);
    }
  });

  test.afterAll(() => {
    for (const proc of procs) {
      proc.kill();
    }
    for (const p of projects) {
      cleanProject(p.name);
    }
  });

  for (const p of projects) {
    test(`${p.model} project renders`, async ({ page }) => {
      await page.goto(`http://localhost:${p.port}`);

      // The SidebarLayout sidebar should contain the project name
      await expect(page.locator("h2")).toContainText(p.name);

      // The main content area should also have the project name
      await expect(page.locator("h1")).toContainText(p.name);
    });
  }
});
