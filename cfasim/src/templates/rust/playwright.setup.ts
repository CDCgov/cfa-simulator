import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";

export default async function globalSetup() {
  const execPath = chromium.executablePath();
  if (!execPath || !existsSync(execPath)) {
    console.error(
      "\n\x1b[31m✗ Playwright Chromium browser is not installed.\x1b[0m\n\n" +
        "  Run this once to download it:\n\n" +
        "    \x1b[36mpnpm run test:e2e:install\x1b[0m\n",
    );
    process.exit(1);
  }
}
