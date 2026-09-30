import { appendFileSync, readFileSync } from "node:fs";
import { installReport, restoreVrtReports } from "./pages.ts";
import {
  VRT_RETENTION_DAYS,
  compareDirectories,
  parseVrtMeta,
  reportPageUrl,
} from "./report.ts";

const distDir = process.env.VRT_DIST ?? "dist";
const baseUrl = process.env.VRT_PAGES_BASE_URL ?? "";
const beforeDir = process.env.VRT_BEFORE_DIR ?? "";
const afterDir = process.env.VRT_AFTER_DIR ?? "";
const reportDir = process.env.VRT_REPORT_DIR ?? "vrt-output/report";
const runId = process.env.VRT_RUN_ID ?? "";
const runAttempt = process.env.VRT_RUN_ATTEMPT ?? "1";
const createdAt = process.env.VRT_CREATED_AT ?? new Date().toISOString();
const metaPath = process.env.META_PATH ?? "";

if (!/^[0-9]+$/.test(runId)) {
  throw new Error(`run id が不正です: ${runId}`);
}

const meta = metaPath ? parseVrtMeta(readFileSync(metaPath, "utf8")) : null;

await restoreVrtReports({ distDir, baseUrl });

let reportReady = false;
let reportUrl = "";
let passed = false;
if (beforeDir && afterDir) {
  const summary = compareDirectories(beforeDir, afterDir, reportDir, {
    prNumber: meta?.prNumber ?? 0,
    prUrl: meta?.prUrl ?? "",
    retentionDays: VRT_RETENTION_DAYS,
  });
  passed = summary.passed;
  if (summary.scenes.length > 0) {
    installReport({
      distDir,
      reportDir,
      entry: {
        runId,
        runAttempt,
        prNumber: meta?.prNumber ?? 0,
        createdAt,
        passed,
        beforeSha: meta?.beforeSha ?? "",
        builtAfterSha: meta?.builtAfterSha ?? "",
        files: [],
      },
    });
    reportReady = true;
    reportUrl = reportPageUrl(baseUrl, runId);
  }
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `report_ready=${reportReady ? "true" : "false"}\nreport_url=${reportUrl}\nreport_passed=${passed ? "true" : "false"}\n`,
  );
}
process.stdout.write(
  reportReady
    ? "レポートをサイトに追加しました\n"
    : "公開する画像がありません\n",
);
