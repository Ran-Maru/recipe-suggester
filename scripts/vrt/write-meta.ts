import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { VrtMeta } from "./report.ts";

function optionalBoolean(value: string | undefined): boolean | null {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

function modeFromEnv(value: string | undefined): VrtMeta["mode"] {
  if (value === "open" || value === "merged") {
    return value;
  }
  return "";
}

const prNumber = Number(process.env.PR_NUMBER);
if (!Number.isInteger(prNumber) || prNumber <= 0) {
  throw new Error(`PR 番号が不正です: ${process.env.PR_NUMBER ?? ""}`);
}

const repository = process.env.GITHUB_REPOSITORY ?? "";
const prUrl =
  process.env.PR_URL ||
  (repository
    ? `https://github.com/${repository}/pull/${String(prNumber)}`
    : "");

const passed = optionalBoolean(process.env.COMPARE_PASSED);
const captureFailed = process.env.CAPTURE_FAILED === "true" || passed === null;

const meta: VrtMeta = {
  prNumber,
  prUrl,
  mode: modeFromEnv(process.env.CHECKOUT_MODE),
  beforeSha: process.env.BEFORE_SHA ?? "",
  headSha: process.env.HEAD_SHA ?? "",
  builtAfterSha: process.env.BUILT_AFTER_SHA ?? "",
  captureFailed,
  passed: captureFailed ? false : passed,
};

const destination = process.env.META_PATH ?? "vrt-output/meta.json";
mkdirSync(path.dirname(destination), { recursive: true });
writeFileSync(destination, `${JSON.stringify(meta, null, 2)}\n`);
