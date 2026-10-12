// processの型定義を参照させるために必要
/// <reference types="node" />
import path from "node:path";
import {
  defineConfig,
  devices,
  type ReporterDescription,
} from "@playwright/test";
import {
  worktreeDevPort,
  worktreePlaywrightHtmlPort,
  worktreePreviewPort,
} from "./scripts/worktree-ports.ts";

const devPort = worktreeDevPort();
const previewPort = worktreePreviewPort();
const playwrightHtmlPort = worktreePlaywrightHtmlPort();
const vrt = process.env.VRT === "1";
// VRT_MODE=update は変更前の画面を基準画像として書き出し、compare は変更後を基準画像と比べる。
const vrtMode = process.env.VRT_MODE === "update" ? "update" : "compare";
const vrtOutDir = path.resolve(process.env.VRT_OUT_DIR ?? "vrt-output");
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
  ...(vrt
    ? {
        outputDir: path.join(vrtOutDir, "test-results"),
        // 基準画像はリポジトリに置かず、変更前の実行で vrt-output/snapshots に作る。
        snapshotPathTemplate: path.join(
          vrtOutDir,
          "snapshots",
          "{projectName}",
          "{arg}{ext}",
        ),
        expect: {
          toHaveScreenshot: {
            maxDiffPixels: 0,
            threshold: 0,
            animations: "disabled" as const,
            caret: "hide" as const,
          },
        },
      }
    : {}),
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only. VRT は同じ画面を何度も撮らない。 */
  retries: process.env.CI && !vrt ? 2 : 0,
  /* Opt out of parallel tests on CI. VRT は画素が揺れないよう常に 1 本。 */
  workers: process.env.CI || vrt ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter:
    vrtReporter() ??
    (process.env.CI
      ? [["github"], ["html", { port: playwrightHtmlPort }]]
      : [["html", { port: playwrightHtmlPort }]]),
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

function vrtReporter(): ReporterDescription[] | undefined {
  if (!vrt) {
    return undefined;
  }
  if (vrtMode === "update") {
    return [["line"]];
  }
  return [
    ["line"],
    ["html", { open: "never", outputFolder: path.join(vrtOutDir, "report") }],
    ["json", { outputFile: path.join(vrtOutDir, "results.json") }],
  ];
}

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
