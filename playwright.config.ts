// processの型定義を参照させるために必要
/// <reference types="node" />
import { defineConfig, devices } from "@playwright/test";
import {
  worktreeDevPort,
  worktreePlaywrightHtmlPort,
  worktreePreviewPort,
} from "./scripts/worktree-ports.ts";

const devPort = worktreeDevPort();
const previewPort = worktreePreviewPort();
const playwrightHtmlPort = worktreePlaywrightHtmlPort();
const vrt = process.env.VRT === "1";
const baseURL = vrt
  ? `http://127.0.0.1:${previewPort}`
  : `http://localhost:${devPort}`;

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  testIgnore: vrt ? undefined : "**/vrt/**",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only. VRT は同じ画面を何度も撮らない。 */
  retries: process.env.CI && !vrt ? 2 : 0,
  /* Opt out of parallel tests on CI. VRT は画素が揺れないよう常に 1 本。 */
  workers: process.env.CI || vrt ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: vrt
    ? "line"
    : process.env.CI
      ? [["github"], ["html", { port: playwrightHtmlPort }]]
      : [["html", { port: playwrightHtmlPort }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // 比較画像を device pixel ではなく CSS px で揃える。
        ...(vrt ? { deviceScaleFactor: 1 } : {}),
      },
    },

    /* Test against mobile viewports. */
    {
      name: "Mobile Chrome",
      use: {
        ...devices["Pixel 7"],
        ...(vrt ? { deviceScaleFactor: 1 } : {}),
      },
    },
    {
      name: "Mobile Safari",
      use: {
        ...devices["iPhone 13 Pro"],
        ...(vrt ? { deviceScaleFactor: 1 } : {}),
      },
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  webServer: vrtWebServer(baseURL, previewPort),
});

function vrtWebServer(
  url: string,
  port: number,
): {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  url: string;
  reuseExistingServer: boolean;
  timeout: number;
} {
  if (!vrt) {
    return {
      command: "vp dev",
      url,
      reuseExistingServer: !process.env.CI,
      timeout: 20 * 1000,
    };
  }
  const previewCwd = process.env.VRT_PREVIEW_CWD;
  if (!previewCwd) {
    throw new Error("VRT=1 のときは VRT_PREVIEW_CWD が必要です");
  }
  return {
    command: "node_modules/.bin/vp preview --host 127.0.0.1",
    cwd: previewCwd,
    env: { PREVIEW_PORT: String(port) },
    url,
    reuseExistingServer: false,
    timeout: 120 * 1000,
  };
}
