import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  VRT_RETENTION_DAYS,
  parseCompareSummary,
  parseVrtMeta,
  renderComment,
} from "./report.ts";

const metaPath = process.env.META_PATH;
const commentPath = process.env.COMMENT_BODY_FILE;
if (!metaPath || !commentPath) {
  throw new Error("META_PATH と COMMENT_BODY_FILE が必要です");
}

const meta = parseVrtMeta(readFileSync(metaPath, "utf8"));
const summaryPath = process.env.SUMMARY_PATH;
const summary =
  summaryPath && existsSync(summaryPath)
    ? parseCompareSummary(readFileSync(summaryPath, "utf8"))
    : null;

const body = renderComment({
  meta,
  summary,
  reportUrl: process.env.REPORT_URL ?? "",
  runUrl: process.env.RUN_URL ?? "",
  retentionDays: VRT_RETENTION_DAYS,
});
writeFileSync(commentPath, body);
