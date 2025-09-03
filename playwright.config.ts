import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests-e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.PREVIEW_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
