import { defineConfig, devices } from "@playwright/test";

const e2ePort = Number(process.env.E2E_DEV_PORT ?? 5199);
const e2eBaseUrl = process.env.E2E_BASE_URL ?? `http://localhost:${e2ePort}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // E2E specs mock HTTP at the browser boundary; frontend dev server is enough locally.
  // Uses E2E_DEV_PORT (default 5199) to avoid clashing with other apps on 5173.
  // Set E2E_BASE_URL (e.g. http://localhost:8080) to reuse Docker Compose instead.
  webServer:
    process.env.CI || process.env.E2E_BASE_URL
      ? undefined
      : {
          command: `cd frontend && VITE_DEV_PORT=${e2ePort} npm run dev`,
          url: e2eBaseUrl,
          reuseExistingServer: false,
          timeout: 60_000,
        },
});
