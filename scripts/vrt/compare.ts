import { appendFileSync } from "node:fs";
import { compareDirectories, VRT_RETENTION_DAYS } from "./report.ts";

const [beforeDir, afterDir, reportDir] = process.argv.slice(2);
if (!beforeDir || !afterDir || !reportDir) {
  process.stderr.write(
    "使い方: node scripts/vrt/compare.ts <before> <after> <report>\n",
  );
  process.exit(2);
}

const prNumber = Number(process.env.PR_NUMBER ?? "0");
const summary = compareDirectories(beforeDir, afterDir, reportDir, {
  prNumber: Number.isInteger(prNumber) ? prNumber : 0,
  prUrl: process.env.PR_URL ?? "",
  retentionDays: VRT_RETENTION_DAYS,
});
const failed = summary.scenes.filter((scene) => scene.status !== "same").length;
const line = summary.passed
  ? `差分はありません（${String(summary.scenes.length)} 画面）`
  : `差分が ${String(failed)} 件あります`;
process.stdout.write(`${line}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## 見た目の比較\n\n${line}\n\nレポートの URL は、公開ワークフローが PR に付けます。\n`,
  );
}
process.exit(summary.passed ? 0 : 1);
