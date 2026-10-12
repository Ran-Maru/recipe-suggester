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
export const REPORT_FILE = "vrt-report.html";

const MAX_LISTED_SCENES = 8;

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

export type SceneResult = {
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
  scenes: SceneResult[];
};

export type CommentInput = {
  prNumber: number;
  beforeSha: string;
  headSha: string;
  captureFailed: boolean;
  summary: CompareSummary | null;
  reportUrl: string;
  runUrl: string;
  retentionDays: number;
};

type Shot = {
  project: string;
  name: string;
  file: string;
};

type SceneImages = {
  before?: Buffer;
  after?: Buffer;
  diff?: Buffer;
};

type Compared = {
  result: SceneResult;
  images: SceneImages;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function parseSceneResult(value: unknown): SceneResult | null {
  if (
    !isRecord(value) ||
    !isSceneStatus(value.status) ||
    typeof value.project !== "string" ||
    typeof value.name !== "string"
  ) {
    return null;
  }
  return {
    project: value.project,
    name: value.name,
    status: value.status,
    diffPixels: typeof value.diffPixels === "number" ? value.diffPixels : null,
    before: parseImageSize(value.before),
    after: parseImageSize(value.after),
    detail:
      typeof value.detail === "string"
        ? value.detail
        : statusLabel(value.status),
  };
}

export function parseCompareSummary(text: string): CompareSummary | null {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || !Array.isArray(value.scenes)) {
    return null;
  }
  return {
    passed: value.passed === true,
    scenes: value.scenes.flatMap((scene) => {
      const parsed = parseSceneResult(scene);
      return parsed ? [parsed] : [];
    }),
  };
}

type Loaded = {
  raw: Buffer;
  image: PNG;
};

function load(shot: Shot): Loaded {
  const raw = readFileSync(shot.file);
  return { raw, image: PNG.sync.read(raw) };
}

function listShots(root: string): Map<string, Shot> {
  const shots = new Map<string, Shot>();
  if (!existsSync(root)) {
    return shots;
  }
  for (const project of readdirSync(root, { withFileTypes: true })) {
    if (!project.isDirectory()) {
      continue;
    }
    const projectDir = path.join(root, project.name);
    for (const entry of readdirSync(projectDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".png")) {
        continue;
      }
      const name = entry.name.slice(0, -".png".length);
      shots.set(`${project.name}/${name}`, {
        project: project.name,
        name,
        file: path.join(projectDir, entry.name),
      });
    }
  }
  return shots;
}

function sizeOf(image: PNG): ImageSize {
  return { width: image.width, height: image.height };
}

function compareShot(
  before: Shot | undefined,
  after: Shot | undefined,
): Compared {
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

  let beforeLoaded: Loaded | null = null;
  let afterLoaded: Loaded | null = null;
  try {
    beforeLoaded = before ? load(before) : null;
    afterLoaded = after ? load(after) : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "画像を読めません";
    return {
      result: { ...base, status: "invalid", detail: message },
      images: {},
    };
  }

  if (!beforeLoaded && afterLoaded) {
    return {
      result: {
        ...base,
        status: "added",
        after: sizeOf(afterLoaded.image),
        detail: statusLabel("added"),
      },
      images: { after: afterLoaded.raw },
    };
  }
  if (beforeLoaded && !afterLoaded) {
    return {
      result: {
        ...base,
        status: "removed",
        before: sizeOf(beforeLoaded.image),
        detail: statusLabel("removed"),
      },
      images: { before: beforeLoaded.raw },
    };
  }
  if (!beforeLoaded || !afterLoaded) {
    throw new Error("比較対象がありません");
  }

  const beforeImage = beforeLoaded.image;
  const afterImage = afterLoaded.image;
  const images: SceneImages = {
    before: beforeLoaded.raw,
    after: afterLoaded.raw,
  };
  const beforeSize = sizeOf(beforeImage);
  const afterSize = sizeOf(afterImage);
  if (
    beforeImage.width !== afterImage.width ||
    beforeImage.height !== afterImage.height
  ) {
    return {
      result: {
        ...base,
        status: "resized",
        before: beforeSize,
        after: afterSize,
        detail: `${statusLabel("resized")}（${String(beforeSize.width)}×${String(beforeSize.height)} → ${String(afterSize.width)}×${String(afterSize.height)}）`,
      },
      images,
    };
  }

  if (beforeImage.data.equals(afterImage.data)) {
    return {
      result: {
        ...base,
        status: "same",
        diffPixels: 0,
        before: beforeSize,
        after: afterSize,
        detail: statusLabel("same"),
      },
      images: {},
    };
  }

  // threshold: 0 で色のわずかな違いも数える。画素が 1 つでも違えば changed。
  const diff = new PNG({ width: beforeSize.width, height: beforeSize.height });
  const diffPixels = pixelmatch(
    beforeImage.data,
    afterImage.data,
    diff.data,
    beforeSize.width,
    beforeSize.height,
    { threshold: 0, includeAA: true },
  );
  return {
    result: {
      ...base,
      status: "changed",
      diffPixels,
      before: beforeSize,
      after: afterSize,
      detail: `${statusLabel("changed")}（${String(diffPixels)} px）`,
    },
    images: { ...images, diff: PNG.sync.write(diff) },
  };
}

export function compareDirectories(
  beforeDir: string,
  afterDir: string,
  reportDir: string,
  options: {
    prNumber?: number;
    prUrl?: string;
    retentionDays?: number;
  } = {},
): CompareSummary {
  const beforeShots = listShots(beforeDir);
  const afterShots = listShots(afterDir);
  const keys = [
    ...new Set([...beforeShots.keys(), ...afterShots.keys()]),
  ].toSorted((left, right) => left.localeCompare(right, "ja"));

  const compared = keys.map((key) =>
    compareShot(beforeShots.get(key), afterShots.get(key)),
  );
  const scenes = compared.map((item) => item.result);
  const summary: CompareSummary = {
    passed:
      scenes.length > 0 && scenes.every((scene) => scene.status === "same"),
    scenes,
  };

  const reportRoot = path.resolve(reportDir);
  rmSync(reportRoot, { recursive: true, force: true });
  mkdirSync(reportRoot, { recursive: true });
  writeFileSync(
    path.join(reportRoot, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  writeFileSync(
    path.join(reportRoot, REPORT_FILE),
    renderReportHtml({
      compared,
      summary,
      prNumber: options.prNumber ?? 0,
      prUrl: options.prUrl ?? "",
      retentionDays: options.retentionDays ?? VRT_RETENTION_DAYS,
    }),
  );
  return summary;
}

function dataUri(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function prLinkHtml(prNumber: number, prUrl: string): string {
  if (prNumber <= 0) {
    return "";
  }
  if (!prUrl.startsWith("https://github.com/")) {
    return `<p>PR #${String(prNumber)}</p>`;
  }
  return `<p>PR <a href="${escapeHtml(prUrl)}">#${String(prNumber)}</a></p>`;
}

function figure(label: string, image: Buffer | undefined): string {
  if (!image) {
    return "";
  }
  return `<figure>
      <img tabindex="0" src="${dataUri(image)}" alt="${escapeHtml(label)}">
      <figcaption>${escapeHtml(label)}</figcaption>
    </figure>`;
}

function sceneSection(item: Compared): string {
  const { result, images } = item;
  const title = `${result.project} / ${result.name}`;
  return `<section class="scene">
  <h2 class="diff">${escapeHtml(title)}</h2>
  <p class="diff">${escapeHtml(result.detail)}</p>
  <div class="shots">
    ${figure("変更前", images.before)}
    ${figure("差分", images.diff)}
    ${figure("変更後", images.after)}
  </div>
</section>`;
}

function renderReportHtml(input: {
  compared: Compared[];
  summary: CompareSummary;
  prNumber: number;
  prUrl: string;
  retentionDays: number;
}): string {
  const changed = input.compared.filter(
    (item) => item.result.status !== "same",
  );
  const same = input.compared.filter((item) => item.result.status === "same");
  const heading =
    input.summary.scenes.length === 0
      ? "比較する画像がありません"
      : input.summary.passed
        ? "差分はありません"
        : `差分が ${String(changed.length)} 件あります`;
  const sameList =
    same.length === 0
      ? ""
      : `<details>
  <summary>差分なし（${String(same.length)} 画面）</summary>
  <ul>
    ${same.map((item) => `<li>${escapeHtml(`${item.result.project} / ${item.result.name}`)}</li>`).join("\n    ")}
  </ul>
</details>`;
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
    img:focus { max-width: none; }
    figcaption { font-size: 0.85rem; margin-top: 4px; }
  </style>
</head>
<body>
  <h1 class="${input.summary.passed ? "same" : "diff"}">${escapeHtml(heading)}</h1>
  ${prLinkHtml(input.prNumber, input.prUrl)}
  <p>画像は ${String(input.retentionDays)} 日、または PR のマージで消えます。消えたあとは Actions の Visual Regression に PR 番号を渡して再実行できます。</p>
  ${changed.map((item) => sceneSection(item)).join("\n  ")}
  ${sameList}
</body>
</html>
`;
}

function shortSha(sha: string): string {
  return sha ? `\`${sha.slice(0, 7)}\`` : "不明";
}

export function renderComment(input: CommentInput): string {
  const lines = ["<!-- vrt-report -->", "## 見た目の比較", ""];
  const summary = input.summary;
  const captureFailed =
    input.captureFailed || summary === null || summary.scenes.length === 0;

  if (captureFailed) {
    lines.push("スクリーンショットの取得に失敗しました。", "");
  } else if (summary.passed) {
    lines.push("差分はありません。", "");
  } else {
    const failed = summary.scenes.filter((scene) => scene.status !== "same");
    lines.push(`差分が ${String(failed.length)} 件あります。`, "");
    for (const scene of failed.slice(0, MAX_LISTED_SCENES)) {
      const detail =
        scene.status === "changed" && scene.diffPixels !== null
          ? `${String(scene.diffPixels)} px`
          : statusLabel(scene.status);
      lines.push(`- ${scene.project} / ${scene.name}: ${detail}`);
    }
    if (failed.length > MAX_LISTED_SCENES) {
      lines.push(`- ほか ${String(failed.length - MAX_LISTED_SCENES)} 件`);
    }
    lines.push("");
  }

  lines.push(
    `変更前は PR の分岐点 ${shortSha(input.beforeSha)}、変更後は PR の head ${shortSha(input.headSha)} です。`,
    "",
  );
  if (input.reportUrl) {
    lines.push(`[比較レポート（HTML）](${input.reportUrl})`, "");
  }
  if (input.runUrl) {
    lines.push(`実行ログ: ${input.runUrl}`, "");
  }
  lines.push(
    "変更前・変更後の画像は artifact の `vrt-before`、`vrt-after` にあります。ソースリポジトリには入れていません。GitHub にログインしていないと artifact は開けません。",
    "",
    `artifact は ${String(input.retentionDays)} 日、または PR のマージで消えます。消えたあとに見たいときは、Actions の Visual Regression を手動実行し、PR 番号に \`${String(input.prNumber)}\` を入れてください。`,
    "",
  );
  return lines.join("\n");
}
