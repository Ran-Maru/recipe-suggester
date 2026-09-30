import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export const VRT_RETENTION_DAYS = 14;
const VRT_MAX_DIFF_PIXELS = 0;
const VRT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const VRT_MAX_DIMENSION = 16_384;
const VRT_MAX_FILES = 100;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

type SceneStatus =
  | "same"
  | "changed"
  | "resized"
  | "added"
  | "removed"
  | "invalid";

type ImageSize = {
  width: number;
  height: number;
};

type SceneResult = {
  project: string;
  name: string;
  status: SceneStatus;
  diffPixels: number | null;
  before: ImageSize | null;
  after: ImageSize | null;
  detail: string;
};

export type CompareSummary = {
  passed: boolean;
  maxDiffPixels: number;
  scenes: SceneResult[];
};

export type VrtMeta = {
  prNumber: number;
  prUrl: string;
  mode: "open" | "merged" | "";
  beforeSha: string;
  headSha: string;
  builtAfterSha: string;
  captureFailed: boolean;
  passed: boolean | null;
};

type Shot = {
  project: string;
  name: string;
  relative: string;
  absolute: string;
};

function statusLabel(status: SceneStatus): string {
  switch (status) {
    case "same":
      return "差分なし";
    case "changed":
      return "差分あり";
    case "resized":
      return "サイズが違う";
    case "added":
      return "変更後だけにある";
    case "removed":
      return "変更前だけにある";
    case "invalid":
      return "画像を読めない";
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function parseVrtMeta(text: string): VrtMeta {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || !isPositiveInt(value.prNumber)) {
    throw new Error("meta.json を読めません");
  }
  const mode = value.mode;
  return {
    prNumber: value.prNumber,
    prUrl: typeof value.prUrl === "string" ? value.prUrl : "",
    mode: mode === "open" || mode === "merged" ? mode : "",
    beforeSha: typeof value.beforeSha === "string" ? value.beforeSha : "",
    headSha: typeof value.headSha === "string" ? value.headSha : "",
    builtAfterSha:
      typeof value.builtAfterSha === "string" ? value.builtAfterSha : "",
    captureFailed: value.captureFailed === true,
    passed: typeof value.passed === "boolean" ? value.passed : null,
  };
}

export function parseCompareSummary(text: string): CompareSummary | null {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || !Array.isArray(value.scenes)) {
    return null;
  }
  const scenes: SceneResult[] = [];
  for (const scene of value.scenes) {
    const parsed = parseSceneResult(scene);
    if (parsed) {
      scenes.push(parsed);
    }
  }
  return {
    passed: value.passed === true,
    maxDiffPixels:
      typeof value.maxDiffPixels === "number"
        ? value.maxDiffPixels
        : VRT_MAX_DIFF_PIXELS,
    scenes,
  };
}

function parseSceneResult(value: unknown): SceneResult | null {
  if (!isRecord(value)) {
    return null;
  }
  const status = value.status;
  if (
    !isSceneStatus(status) ||
    typeof value.project !== "string" ||
    typeof value.name !== "string"
  ) {
    return null;
  }
  return {
    project: value.project,
    name: value.name,
    status,
    diffPixels: typeof value.diffPixels === "number" ? value.diffPixels : null,
    before: parseImageSize(value.before),
    after: parseImageSize(value.after),
    detail:
      typeof value.detail === "string" ? value.detail : statusLabel(status),
  };
}

function parseImageSize(value: unknown): ImageSize | null {
  if (
    !isRecord(value) ||
    typeof value.width !== "number" ||
    typeof value.height !== "number"
  ) {
    return null;
  }
  return { width: value.width, height: value.height };
}

function isSceneStatus(value: unknown): value is SceneStatus {
  return (
    value === "same" ||
    value === "changed" ||
    value === "resized" ||
    value === "added" ||
    value === "removed" ||
    value === "invalid"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

export function withTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

export function reportPageUrl(baseUrl: string, runId: string): string {
  if (!/^[0-9]+$/.test(runId)) {
    throw new Error(`run id が不正です: ${runId}`);
  }
  return new URL(`vrt/runs/${runId}/index.html`, withTrailingSlash(baseUrl))
    .href;
}

export function compareDirectories(
  beforeDir: string,
  afterDir: string,
  reportDir: string,
  options: { prNumber?: number; prUrl?: string; retentionDays?: number } = {},
): CompareSummary {
  const reportRoot = assertDeletableDirectory(reportDir);
  rmSync(reportRoot, { recursive: true, force: true });
  mkdirSync(reportRoot, { recursive: true });

  const beforeShots = listShots(beforeDir);
  const afterShots = listShots(afterDir);
  const keys = [
    ...new Set([...beforeShots.keys(), ...afterShots.keys()]),
  ].toSorted((left, right) => left.localeCompare(right, "ja"));

  const scenes = keys.map((key) =>
    compareShot(beforeShots.get(key), afterShots.get(key), reportRoot),
  );
  const summary: CompareSummary = {
    passed:
      scenes.length > 0 && scenes.every((scene) => scene.status === "same"),
    maxDiffPixels: VRT_MAX_DIFF_PIXELS,
    scenes,
  };

  writeFileSync(
    path.join(reportRoot, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  writeFileSync(
    path.join(reportRoot, "index.html"),
    renderReportHtml({
      summary,
      prNumber: options.prNumber ?? 0,
      prUrl: options.prUrl ?? "",
      retentionDays: options.retentionDays ?? VRT_RETENTION_DAYS,
    }),
  );
  return summary;
}

function renderReportHtml(input: {
  summary: CompareSummary;
  prNumber: number;
  prUrl: string;
  retentionDays: number;
}): string {
  const failed = input.summary.scenes.filter(
    (scene) => scene.status !== "same",
  );
  const heading =
    input.summary.scenes.length === 0
      ? "比較する画像がありません"
      : input.summary.passed
        ? "差分はありません"
        : `差分が ${String(failed.length)} 件あります`;
  const prLink =
    input.prNumber > 0
      ? input.prUrl
        ? `<p>PR <a href="${escapeHtml(input.prUrl)}">#${String(input.prNumber)}</a></p>`
        : `<p>PR #${String(input.prNumber)}</p>`
      : "";
  const sections = input.summary.scenes
    .map((scene) => sceneSection(scene))
    .join("\n");
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>見た目の比較</title>
  <style>
    body { font-family: sans-serif; margin: 24px; color: #1f2328; }
    h1 { font-size: 1.5rem; }
    .same { color: #0b6b2f; }
    .diff { color: #9f1239; }
    .scene { margin: 32px 0; }
    .shots { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-start; }
    figure { margin: 0; }
    img { max-width: min(360px, 100%); height: auto; border: 1px solid #d0d7de; background: #fff; }
    figcaption { font-size: 0.85rem; margin-top: 4px; }
  </style>
</head>
<body>
  <h1 class="${input.summary.passed ? "same" : "diff"}">${escapeHtml(heading)}</h1>
  ${prLink}
  <p>画像は ${String(input.retentionDays)} 日で消えます。消えたあとは Actions の Visual Regression に PR 番号を渡して再実行できます。</p>
  ${sections}
</body>
</html>
`;
}

export function renderComment(input: {
  meta: VrtMeta;
  summary: CompareSummary | null;
  reportUrl: string;
  runUrl: string;
  retentionDays: number;
}): string {
  const lines = ["<!-- vrt-report -->", "## 見た目の比較", ""];
  const summary = input.summary;
  const captureFailed =
    input.meta.captureFailed || summary === null || summary.scenes.length === 0;

  if (captureFailed) {
    lines.push("スクリーンショットの取得に失敗しました。", "");
  } else if (summary.passed) {
    lines.push("差分はありません。", "");
  } else {
    const failed = summary.scenes.filter((scene) => scene.status !== "same");
    lines.push(`差分が ${String(failed.length)} 件あります。`, "");
    for (const scene of failed.slice(0, 8)) {
      const detail =
        scene.status === "changed" && scene.diffPixels !== null
          ? `${String(scene.diffPixels)} px`
          : statusLabel(scene.status);
      lines.push(`- ${scene.project} / ${scene.name}: ${detail}`);
    }
    if (failed.length > 8) {
      lines.push(`- ほか ${String(failed.length - 8)} 件`);
    }
    lines.push("");
  }

  lines.push(comparisonTarget(input.meta), "");
  if (input.reportUrl) {
    lines.push(`[比較結果を開く](${input.reportUrl})`, "");
  }
  if (input.runUrl) {
    lines.push(`実行ログ: ${input.runUrl}`, "");
  }
  lines.push(
    "変更前・変更後・差分の画像は artifact の `vrt-before`、`vrt-after`、`vrt-diff` にあります。ソースリポジトリには入れていません。",
    "",
    `レポートと artifact は ${String(input.retentionDays)} 日で消えます。消えたあとに見たいときは、Actions の Visual Regression を手動実行し、PR 番号に \`${String(input.meta.prNumber)}\` を入れてください。`,
    "",
  );
  return lines.join("\n");
}

function comparisonTarget(meta: VrtMeta): string {
  const before = meta.beforeSha ? `\`${shortSha(meta.beforeSha)}\`` : "不明";
  if (meta.mode === "merged") {
    const after = meta.builtAfterSha
      ? `\`${shortSha(meta.builtAfterSha)}\``
      : "不明";
    return `変更前はマージ直前の ${before}、変更後はマージコミット ${after} です。`;
  }
  const head = meta.headSha ? `\`${shortSha(meta.headSha)}\`` : "不明";
  return `変更前は base の ${before}、変更後は head ${head} にその base をマージしたビルドです。`;
}

function sceneSection(scene: SceneResult): string {
  const title = `${scene.project} / ${scene.name}`;
  const klass = scene.status === "same" ? "same" : "diff";
  const detail =
    scene.status === "changed" && scene.diffPixels !== null
      ? `${statusLabel(scene.status)}（${String(scene.diffPixels)} px）`
      : scene.detail || statusLabel(scene.status);
  return `<section class="scene">
  <h2 class="${klass}">${escapeHtml(title)}</h2>
  <p class="${klass}">${escapeHtml(detail)}</p>
  <div class="shots">
    ${shotFigure(scene, "before", "変更前")}
    ${shotFigure(scene, "diff", "差分")}
    ${shotFigure(scene, "after", "変更後")}
  </div>
</section>`;
}

function shotFigure(
  scene: SceneResult,
  kind: "before" | "after" | "diff",
  label: string,
): string {
  if (kind === "diff" && scene.status !== "changed") {
    return "";
  }
  if (
    kind === "before" &&
    (scene.status === "added" || scene.before === null)
  ) {
    return "";
  }
  if (
    kind === "after" &&
    (scene.status === "removed" || scene.after === null)
  ) {
    return "";
  }
  const src = `images/${scene.project}/${scene.name}/${kind}.png`;
  return `<figure>
    <a href="${src}"><img src="${src}" alt="${escapeHtml(label)}"></a>
    <figcaption>${escapeHtml(label)}</figcaption>
  </figure>`;
}

function compareShot(
  before: Shot | undefined,
  after: Shot | undefined,
  reportRoot: string,
): SceneResult {
  const sample = before ?? after;
  if (!sample) {
    throw new Error("比較対象がありません");
  }
  const base = {
    project: sample.project,
    name: sample.name,
    diffPixels: null,
    before: null,
    after: null,
  };
  if (!before) {
    copyShot(after, reportRoot, "after");
    return {
      ...base,
      status: "added",
      after: readSize(after),
      detail: statusLabel("added"),
    };
  }
  if (!after) {
    copyShot(before, reportRoot, "before");
    return {
      ...base,
      status: "removed",
      before: readSize(before),
      detail: statusLabel("removed"),
    };
  }

  let beforeImage: PNG;
  let afterImage: PNG;
  try {
    beforeImage = readPng(before.absolute);
    afterImage = readPng(after.absolute);
  } catch (error) {
    const message = error instanceof Error ? error.message : "画像を読めません";
    return { ...base, status: "invalid", detail: message };
  }

  copyShot(before, reportRoot, "before");
  copyShot(after, reportRoot, "after");
  const beforeSize = { width: beforeImage.width, height: beforeImage.height };
  const afterSize = { width: afterImage.width, height: afterImage.height };
  if (
    beforeImage.width !== afterImage.width ||
    beforeImage.height !== afterImage.height
  ) {
    return {
      ...base,
      status: "resized",
      before: beforeSize,
      after: afterSize,
      detail: `${statusLabel("resized")}（${String(beforeImage.width)}×${String(beforeImage.height)} → ${String(afterImage.width)}×${String(afterImage.height)}）`,
    };
  }

  const diff = new PNG({
    width: beforeImage.width,
    height: beforeImage.height,
  });
  const diffPixels = pixelmatch(
    beforeImage.data,
    afterImage.data,
    diff.data,
    beforeImage.width,
    beforeImage.height,
    { threshold: 0.1, includeAA: true },
  );
  const changed = diffPixels > VRT_MAX_DIFF_PIXELS;
  if (changed) {
    const diffPath = shotPath(reportRoot, sample, "diff");
    mkdirSync(path.dirname(diffPath), { recursive: true });
    writeFileSync(diffPath, PNG.sync.write(diff));
  }
  return {
    ...base,
    status: changed ? "changed" : "same",
    diffPixels,
    before: beforeSize,
    after: afterSize,
    detail: changed
      ? `${statusLabel("changed")}（${String(diffPixels)} px）`
      : statusLabel("same"),
  };
}

function readSize(shot: Shot | undefined): ImageSize | null {
  if (!shot) {
    return null;
  }
  try {
    const image = readPng(shot.absolute);
    return { width: image.width, height: image.height };
  } catch {
    return null;
  }
}

function copyShot(
  shot: Shot | undefined,
  reportRoot: string,
  kind: "before" | "after",
): void {
  if (!shot) {
    return;
  }
  const destination = shotPath(reportRoot, shot, kind);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, readFileSync(shot.absolute));
}

function shotPath(
  reportRoot: string,
  shot: Shot,
  kind: "before" | "after" | "diff",
): string {
  return path.join(
    reportRoot,
    "images",
    shot.project,
    shot.name,
    `${kind}.png`,
  );
}

function listShots(root: string): Map<string, Shot> {
  const shots = new Map<string, Shot>();
  if (!root || !existsSync(root)) {
    return shots;
  }
  const resolved = path.resolve(root);
  walkPngs(resolved, resolved, shots);
  if (shots.size > VRT_MAX_FILES) {
    throw new Error(`PNG が ${String(VRT_MAX_FILES)} 件を超えています`);
  }
  return shots;
}

function walkPngs(
  root: string,
  current: string,
  shots: Map<string, Shot>,
): void {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      continue;
    }
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      walkPngs(root, absolute, shots);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".png")) {
      continue;
    }
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    const shot = parseShot(relative, absolute);
    if (shot) {
      shots.set(`${shot.project}/${shot.name}`, shot);
    }
  }
}

function parseShot(relative: string, absolute: string): Shot | null {
  const parts = relative.split("/");
  if (parts.length !== 2) {
    return null;
  }
  const [project, file] = parts;
  if (!project || !file?.endsWith(".png")) {
    return null;
  }
  const name = file.slice(0, -".png".length);
  if (!SAFE_SEGMENT.test(project) || !SAFE_SEGMENT.test(name)) {
    return null;
  }
  return { project, name, relative, absolute };
}

function readPng(file: string): PNG {
  const buffer = readFileSync(file);
  if (buffer.length > VRT_MAX_IMAGE_BYTES) {
    throw new Error(`画像が大きすぎます: ${path.basename(file)}`);
  }
  if (
    buffer.length < PNG_MAGIC.length ||
    !buffer.subarray(0, 8).equals(PNG_MAGIC)
  ) {
    throw new Error(`PNG ではありません: ${path.basename(file)}`);
  }
  const image = PNG.sync.read(buffer);
  if (image.width > VRT_MAX_DIMENSION || image.height > VRT_MAX_DIMENSION) {
    throw new Error(`画像の辺が長すぎます: ${path.basename(file)}`);
  }
  if (image.width <= 0 || image.height <= 0) {
    throw new Error(`画像のサイズが不正です: ${path.basename(file)}`);
  }
  return image;
}

function assertDeletableDirectory(target: string): string {
  const resolved = path.resolve(target);
  const root = path.parse(resolved).root;
  if (resolved === root) {
    throw new Error("出力先が不正です");
  }
  return resolved;
}
