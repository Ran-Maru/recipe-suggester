// 起点 2026-10-02（金曜）から 14 日ごと。日本には夏時間がないので UTC+9 で日付を取る。
// cron が遅れて土曜になっても、その回は実行する。
import { appendFileSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ANCHOR_UTC = Date.UTC(2026, 9, 2);
const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function jstCalendarDayUtc(now: Date): number {
  const shifted = new Date(now.getTime() + JST_OFFSET_MS);
  return Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
}

export function shouldRunBiweeklyAudit(eventName: string, now: Date): boolean {
  if (eventName === "workflow_dispatch") {
    return true;
  }
  const days = Math.floor((jstCalendarDayUtc(now) - ANCHOR_UTC) / DAY_MS);
  if (days < 0) {
    return false;
  }
  const mod = days % 14;
  return mod === 0 || mod === 1;
}

function appendGithubOutput(name: string, value: string): void {
  if (name.length === 0 || /[\r\n]/.test(name) || /[\r\n]/.test(value)) {
    throw new Error("GITHUB_OUTPUT に書けない値です");
  }
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath === undefined || outputPath.length === 0) {
    throw new Error("GITHUB_OUTPUT がありません");
  }
  appendFileSync(outputPath, `${name}=${value}\n`);
}

function main(): void {
  const eventName = process.env.EVENT_NAME;
  if (eventName === undefined) {
    throw new Error("EVENT_NAME がありません");
  }
  const run = shouldRunBiweeklyAudit(eventName, new Date());
  appendGithubOutput("run", run ? "true" : "false");
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  try {
    main();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
