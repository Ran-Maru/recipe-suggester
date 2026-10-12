export const VRT_RETENTION_DAYS = 14;

const MAX_LISTED_SCENES = 8;
// eslint-disable-next-line no-control-regex -- Playwright のエラー文に混じる色付けの ANSI エスケープを外す
const ANSI = /\u001B\[[0-9;]*m/g;

type SceneStatus = "same" | "changed" | "resized" | "added" | "failed";

export type SceneResult = {
  project: string;
  name: string;
  status: SceneStatus;
  diffPixels: number | null;
  detail: string;
};

export type RunSummary = {
  passed: boolean;
  scenes: SceneResult[];
};

export type CommentInput = {
  prNumber: number;
  beforeSha: string;
  headSha: string;
  captureFailed: boolean;
  summary: RunSummary | null;
  reportUrl: string;
  runUrl: string;
  retentionDays: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorMessage(result: unknown): string {
  if (!isRecord(result)) {
    return "";
  }
  const errors = Array.isArray(result.errors) ? result.errors : [];
  const messages = errors.flatMap((error) =>
    isRecord(error) && typeof error.message === "string" ? [error.message] : [],
  );
  if (messages.length === 0 && isRecord(result.error)) {
    const single = result.error.message;
    if (typeof single === "string") {
      return single.replace(ANSI, "");
    }
  }
  return messages.join("\n").replace(ANSI, "");
}

function firstLine(message: string): string {
  const line = message
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item !== "");
  return line ?? "原因を読めません";
}

export function classify(
  message: string,
): Pick<SceneResult, "status" | "diffPixels" | "detail"> {
  if (/A snapshot doesn't exist/i.test(message)) {
    return {
      status: "added",
      diffPixels: null,
      detail: "変更前にない画面",
    };
  }
  const size =
    /Expected an image (\d+)px by (\d+)px, received (\d+)px by (\d+)px/i.exec(
      message,
    );
  if (size) {
    return {
      status: "resized",
      diffPixels: null,
      detail: `サイズが違う（${size[1]}×${size[2]} → ${size[3]}×${size[4]}）`,
    };
  }
  const pixels =
    /(\d+) pixels? \(ratio [0-9.]+ of all image pixels\) (?:is|are) different/i.exec(
      message,
    );
  if (pixels) {
    const count = Number(pixels[1]);
    return {
      status: "changed",
      diffPixels: count,
      detail: `差分あり（${String(count)} px）`,
    };
  }
  return {
    status: "failed",
    diffPixels: null,
    detail: `撮影に失敗: ${firstLine(message)}`,
  };
}

function collectScenes(node: unknown, scenes: SceneResult[]): void {
  if (!isRecord(node)) {
    return;
  }
  for (const suite of Array.isArray(node.suites) ? node.suites : []) {
    collectScenes(suite, scenes);
  }
  for (const spec of Array.isArray(node.specs) ? node.specs : []) {
    if (!isRecord(spec) || typeof spec.title !== "string") {
      continue;
    }
    for (const test of Array.isArray(spec.tests) ? spec.tests : []) {
      const scene = sceneFromTest(spec.title, test);
      if (scene) {
        scenes.push(scene);
      }
    }
  }
}

function sceneFromTest(name: string, test: unknown): SceneResult | null {
  if (!isRecord(test) || typeof test.projectName !== "string") {
    return null;
  }
  const project = test.projectName;
  if (test.status === "skipped") {
    return null;
  }
  if (test.status === "expected") {
    return {
      project,
      name,
      status: "same",
      diffPixels: 0,
      detail: "差分なし",
    };
  }
  const results = Array.isArray(test.results) ? test.results : [];
  const message = errorMessage(results.at(-1));
  return { project, name, ...classify(message) };
}

export function parseResults(text: string): RunSummary | null {
  const root: unknown = JSON.parse(text);
  if (!isRecord(root)) {
    return null;
  }
  const scenes: SceneResult[] = [];
  collectScenes(root, scenes);
  scenes.sort((left, right) =>
    `${left.project}/${left.name}`.localeCompare(
      `${right.project}/${right.name}`,
      "ja",
    ),
  );
  return {
    passed:
      scenes.length > 0 && scenes.every((scene) => scene.status === "same"),
    scenes,
  };
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
      lines.push(`- ${scene.project} / ${scene.name}: ${scene.detail}`);
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
    lines.push(`[比較レポートを開く](${input.reportUrl})`, "");
  }
  if (input.runUrl) {
    lines.push(`実行ログ: ${input.runUrl}`, "");
  }
  lines.push(
    `レポートは ${String(input.retentionDays)} 日、または PR のマージで消えます。消えたあとに見たいときは、Actions の Visual Regression を手動実行し、PR 番号に \`${String(input.prNumber)}\` を入れてください。`,
    "",
  );
  return lines.join("\n");
}
