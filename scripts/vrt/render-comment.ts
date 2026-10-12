import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { VRT_RETENTION_DAYS, parseResults, renderComment } from "./results.ts";

const commentPath = process.env.COMMENT_BODY_FILE;
const prNumber = Number(process.env.PR_NUMBER);
if (!commentPath || !Number.isInteger(prNumber) || prNumber <= 0) {
  throw new Error("COMMENT_BODY_FILE と PR_NUMBER が必要です");
}

const resultsPath = process.env.RESULTS_PATH;
const summary =
  resultsPath && existsSync(resultsPath)
    ? parseResults(readFileSync(resultsPath, "utf8"))
    : null;

writeFileSync(
  commentPath,
  renderComment({
    prNumber,
    beforeSha: process.env.BEFORE_SHA ?? "",
    headSha: process.env.HEAD_SHA ?? "",
    captureFailed: process.env.CAPTURE_FAILED === "true",
    summary,
    reportUrl: process.env.REPORT_URL ?? "",
    runUrl: process.env.RUN_URL ?? "",
    retentionDays: VRT_RETENTION_DAYS,
  }),
);
