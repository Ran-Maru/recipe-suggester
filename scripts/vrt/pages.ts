import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { VRT_RETENTION_DAYS, escapeHtml, withTrailingSlash } from "./report.ts";

const VRT_MAX_STORED_REPORTS = 30;

const SAFE_RELATIVE = /^[a-zA-Z0-9._/-]+$/;

export type StoredReport = {
  runId: string;
  runAttempt: string;
  prNumber: number;
  createdAt: string;
  passed: boolean;
  beforeSha: string;
  builtAfterSha: string;
  files: string[];
};

export type VrtManifest = {
  retentionDays: number;
  reports: StoredReport[];
};

function emptyManifest(retentionDays = VRT_RETENTION_DAYS): VrtManifest {
  return { retentionDays, reports: [] };
}

export function pruneReports(
  reports: readonly StoredReport[],
  now: Date,
  retentionDays: number,
): StoredReport[] {
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  const fresh = reports.filter((report) => {
    const created = Date.parse(report.createdAt);
    return Number.isFinite(created) && now.getTime() - created <= maxAgeMs;
  });
  return fresh
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, VRT_MAX_STORED_REPORTS);
}

function renderRunsIndex(manifest: VrtManifest): string {
  const items =
    manifest.reports.length === 0
      ? "<li>レポートはまだありません。</li>"
      : manifest.reports
          .map((report) => {
            const label = report.passed ? "差分なし" : "差分あり";
            const when = report.createdAt.slice(0, 10);
            return `<li><a href="runs/${escapeHtml(report.runId)}/index.html">PR #${String(report.prNumber)} · ${escapeHtml(when)} · ${label}</a></li>`;
          })
          .join("\n");
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex">
  <title>見た目の比較</title>
</head>
<body>
  <h1>見た目の比較</h1>
  <p>レポートは ${String(manifest.retentionDays)} 日で消えます。消えたあとは Actions の Visual Regression に PR 番号を渡して再実行できます。</p>
  <ul>
    ${items}
  </ul>
</body>
</html>
`;
}

export function manifestUrl(baseUrl: string): string {
  return new URL("vrt/manifest.json", withTrailingSlash(baseUrl)).href;
}

export async function restoreVrtReports(options: {
  distDir: string;
  baseUrl: string;
  now?: Date;
  retentionDays?: number;
  fetchImpl?: typeof fetch;
}): Promise<VrtManifest> {
  const retentionDays = options.retentionDays ?? VRT_RETENTION_DAYS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const loaded = await loadRemoteManifest(options.baseUrl, fetchImpl);
  const kept = pruneReports(loaded.reports, now, retentionDays);
  const restored: StoredReport[] = [];
  for (const report of kept) {
    const files = await downloadReport(
      options.distDir,
      options.baseUrl,
      report,
      fetchImpl,
    );
    if (files === null) {
      rmSync(runDirectory(options.distDir, report.runId), {
        recursive: true,
        force: true,
      });
      continue;
    }
    restored.push({ ...report, files });
  }
  const manifest: VrtManifest = { retentionDays, reports: restored };
  writeManifest(options.distDir, manifest);
  return manifest;
}

export function installReport(options: {
  distDir: string;
  reportDir: string;
  entry: StoredReport;
  now?: Date;
  retentionDays?: number;
}): VrtManifest {
  const retentionDays = options.retentionDays ?? VRT_RETENTION_DAYS;
  const now = options.now ?? new Date();
  assertRunId(options.entry.runId);
  const current = readManifest(options.distDir);
  const files = copyReportFiles(
    options.reportDir,
    runDirectory(options.distDir, options.entry.runId),
  );
  const entry = { ...options.entry, files };
  const withoutSameRun = current.reports.filter(
    (report) => report.runId !== entry.runId,
  );
  const manifest: VrtManifest = {
    retentionDays,
    reports: pruneReports([entry, ...withoutSameRun], now, retentionDays),
  };
  removeDroppedRuns(options.distDir, manifest);
  writeManifest(options.distDir, manifest);
  return manifest;
}

function readManifest(distDir: string): VrtManifest {
  const file = path.join(distDir, "vrt", "manifest.json");
  if (!existsSync(file)) {
    return emptyManifest();
  }
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  return sanitizeManifest(parsed);
}

function writeManifest(distDir: string, manifest: VrtManifest): void {
  const dir = path.join(distDir, "vrt");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  writeFileSync(path.join(dir, "index.html"), renderRunsIndex(manifest));
}

async function loadRemoteManifest(
  baseUrl: string,
  fetchImpl: typeof fetch,
): Promise<VrtManifest> {
  if (!baseUrl) {
    throw new Error("GitHub Pages の base URL が空です");
  }
  const response = await fetchImpl(manifestUrl(baseUrl));
  if (response.status === 404) {
    return emptyManifest();
  }
  if (!response.ok) {
    throw new Error(
      `レポート一覧を取得できませんでした: ${String(response.status)} ${manifestUrl(baseUrl)}`,
    );
  }
  const parsed: unknown = await response.json();
  return sanitizeManifest(parsed);
}

async function downloadReport(
  distDir: string,
  baseUrl: string,
  report: StoredReport,
  fetchImpl: typeof fetch,
): Promise<string[] | null> {
  assertRunId(report.runId);
  if (report.files.length === 0) {
    return null;
  }
  const saved: string[] = [];
  for (const relative of report.files) {
    if (!isSafeRelative(relative)) {
      return null;
    }
    const url = new URL(
      `vrt/runs/${report.runId}/${relative}`,
      withTrailingSlash(baseUrl),
    ).href;
    const response = await fetchImpl(url);
    if (!response.ok) {
      return null;
    }
    const destination = path.join(
      runDirectory(distDir, report.runId),
      ...relative.split("/"),
    );
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
    saved.push(relative);
  }
  return saved;
}

function copyReportFiles(reportDir: string, destinationDir: string): string[] {
  const files: string[] = [];
  collectFiles(reportDir, reportDir, files);
  rmSync(destinationDir, { recursive: true, force: true });
  mkdirSync(destinationDir, { recursive: true });
  for (const relative of files) {
    const from = path.join(reportDir, ...relative.split("/"));
    const to = path.join(destinationDir, ...relative.split("/"));
    mkdirSync(path.dirname(to), { recursive: true });
    cpSync(from, to);
  }
  return files;
}

function collectFiles(root: string, current: string, files: string[]): void {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      throw new Error(`シンボリックリンクは使えません: ${entry.name}`);
    }
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      collectFiles(root, absolute, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (!isSafeRelative(relative)) {
      throw new Error(`不正なパスです: ${relative}`);
    }
    if (
      !relative.endsWith(".png") &&
      !relative.endsWith(".html") &&
      !relative.endsWith(".json")
    ) {
      continue;
    }
    files.push(relative);
  }
}

function removeDroppedRuns(distDir: string, manifest: VrtManifest): void {
  const runsDir = path.join(distDir, "vrt", "runs");
  if (!existsSync(runsDir)) {
    return;
  }
  const keep = new Set(manifest.reports.map((report) => report.runId));
  for (const entry of readdirSync(runsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || keep.has(entry.name)) {
      continue;
    }
    rmSync(path.join(runsDir, entry.name), { recursive: true, force: true });
  }
}

function runDirectory(distDir: string, runId: string): string {
  assertRunId(runId);
  return path.join(distDir, "vrt", "runs", runId);
}

function assertRunId(runId: string): void {
  if (!/^[0-9]+$/.test(runId)) {
    throw new Error(`run id が不正です: ${runId}`);
  }
}

function isSafeRelative(relative: string): boolean {
  return (
    SAFE_RELATIVE.test(relative) &&
    !relative.split("/").includes("..") &&
    !path.isAbsolute(relative)
  );
}

function sanitizeManifest(value: unknown): VrtManifest {
  if (typeof value !== "object" || value === null) {
    return emptyManifest();
  }
  const reports = Reflect.get(value, "reports");
  if (!Array.isArray(reports)) {
    return emptyManifest();
  }
  return {
    retentionDays: VRT_RETENTION_DAYS,
    reports: reports.flatMap((report) => {
      const stored = sanitizeReport(report);
      return stored ? [stored] : [];
    }),
  };
}

function sanitizeReport(value: unknown): StoredReport | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const runId = Reflect.get(value, "runId");
  const files = Reflect.get(value, "files");
  const prNumber = Reflect.get(value, "prNumber");
  const createdAt = Reflect.get(value, "createdAt");
  const passed = Reflect.get(value, "passed");
  if (
    typeof runId !== "string" ||
    !/^[0-9]+$/.test(runId) ||
    !Array.isArray(files) ||
    !files.every((file) => typeof file === "string") ||
    typeof prNumber !== "number" ||
    typeof createdAt !== "string" ||
    typeof passed !== "boolean"
  ) {
    return null;
  }
  const runAttempt = Reflect.get(value, "runAttempt");
  const beforeSha = Reflect.get(value, "beforeSha");
  const builtAfterSha = Reflect.get(value, "builtAfterSha");
  return {
    runId,
    runAttempt: typeof runAttempt === "string" ? runAttempt : "1",
    prNumber,
    createdAt,
    passed,
    beforeSha: typeof beforeSha === "string" ? beforeSha : "",
    builtAfterSha: typeof builtAfterSha === "string" ? builtAfterSha : "",
    files,
  };
}
