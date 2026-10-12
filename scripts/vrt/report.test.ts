import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vite-plus/test";
import {
  REPORT_FILE,
  VRT_RETENTION_DAYS,
  compareDirectories,
  escapeHtml,
  parseCompareSummary,
  renderComment,
  type CommentInput,
  type SceneResult,
} from "./report.ts";

function writePng(
  file: string,
  width: number,
  height: number,
  red: number,
): void {
  const png = new PNG({ width, height });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data[offset] = red;
    png.data[offset + 1] = 0;
    png.data[offset + 2] = 0;
    png.data[offset + 3] = 255;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, PNG.sync.write(png));
}

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "vrt-report-"));
}

function compare(root: string, options = {}) {
  return compareDirectories(
    path.join(root, "before"),
    path.join(root, "after"),
    path.join(root, "report"),
    options,
  );
}

function readReport(root: string): string {
  return readFileSync(path.join(root, "report", REPORT_FILE), "utf8");
}

describe("compareDirectories", () => {
  it("同じ画像は差分なしになり、画像は埋め込まない", () => {
    const root = tempDir();
    writePng(path.join(root, "before/chromium/home.png"), 2, 2, 10);
    writePng(path.join(root, "after/chromium/home.png"), 2, 2, 10);
    const summary = compare(root);
    expect(summary.passed).toBe(true);
    expect(summary.scenes[0]?.status).toBe("same");
    const html = readReport(root);
    expect(html).toContain("差分はありません");
    expect(html).toContain("差分なし（1 画面）");
    expect(html).not.toContain("data:image/png");
  });

  it("1 px でも違えば差分ありになり、前後と差分を HTML に埋め込む", () => {
    const root = tempDir();
    writePng(path.join(root, "before/chromium/home.png"), 2, 2, 10);
    writePng(path.join(root, "after/chromium/home.png"), 2, 2, 200);
    const summary = compare(root, { prNumber: 42 });
    expect(summary.passed).toBe(false);
    expect(summary.scenes[0]?.status).toBe("changed");
    expect(summary.scenes[0]?.diffPixels).toBeGreaterThan(0);
    const html = readReport(root);
    expect(html).toContain("差分が 1 件あります");
    expect(html.match(/data:image\/png;base64,/g)).toHaveLength(3);
  });

  it("赤が 1 だけ違う画素も差分として数える", () => {
    const root = tempDir();
    writePng(path.join(root, "before/chromium/home.png"), 4, 4, 254);
    writePng(path.join(root, "after/chromium/home.png"), 4, 4, 255);
    const summary = compare(root);
    expect(summary.passed).toBe(false);
    expect(summary.scenes[0]?.status).toBe("changed");
  });

  it("サイズが違う画面は失敗にする", () => {
    const root = tempDir();
    writePng(path.join(root, "before/mobile-chrome/recipes.png"), 2, 2, 10);
    writePng(path.join(root, "after/mobile-chrome/recipes.png"), 3, 2, 10);
    const summary = compare(root);
    expect(summary.scenes[0]?.status).toBe("resized");
    expect(summary.passed).toBe(false);
  });

  it("片側にしかない画像は失敗にし、階層の違うファイルは無視する", () => {
    const root = tempDir();
    writePng(path.join(root, "before/chromium/home.png"), 2, 2, 10);
    writePng(path.join(root, "after/chromium/added.png"), 2, 2, 10);
    writePng(path.join(root, "before/not-a-pair.png"), 2, 2, 1);
    const summary = compare(root);
    const statuses = summary.scenes.map((scene) => scene.status).toSorted();
    expect(statuses).toEqual(["added", "removed"]);
    expect(summary.passed).toBe(false);
  });

  it("PNG として読めない画像は invalid にする", () => {
    const root = tempDir();
    writePng(path.join(root, "before/chromium/home.png"), 2, 2, 10);
    mkdirSync(path.join(root, "after/chromium"), { recursive: true });
    writeFileSync(path.join(root, "after/chromium/home.png"), "not a png");
    const summary = compare(root);
    expect(summary.scenes[0]?.status).toBe("invalid");
    expect(summary.passed).toBe(false);
  });

  it("比較する画像が 1 枚もなければ失敗にする", () => {
    const root = tempDir();
    const summary = compare(root);
    expect(summary.scenes).toEqual([]);
    expect(summary.passed).toBe(false);
  });

  it("summary.json を読み戻せる", () => {
    const root = tempDir();
    writePng(path.join(root, "before/chromium/home.png"), 2, 2, 10);
    writePng(path.join(root, "after/chromium/home.png"), 2, 2, 200);
    const written = compare(root);
    const parsed = parseCompareSummary(
      readFileSync(path.join(root, "report/summary.json"), "utf8"),
    );
    expect(parsed).toEqual(written);
  });

  it("GitHub 以外の PR URL はリンクにしない", () => {
    const root = tempDir();
    writePng(path.join(root, "before/chromium/home.png"), 2, 2, 10);
    writePng(path.join(root, "after/chromium/home.png"), 2, 2, 10);
    compare(root, { prNumber: 7, prUrl: "javascript:alert(1)" });
    const html = readReport(root);
    expect(html).not.toContain("javascript:");
    expect(html).toContain("PR #7");
  });
});

const changedScene: SceneResult = {
  project: "chromium",
  name: "home",
  status: "changed",
  diffPixels: 12,
  before: { width: 2, height: 2 },
  after: { width: 2, height: 2 },
  detail: "差分あり（12 px）",
};

const commentBase: CommentInput = {
  prNumber: 42,
  beforeSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  captureFailed: false,
  summary: { passed: false, scenes: [changedScene] },
  reportUrl: "https://github.com/example/repo/actions/runs/9/artifacts/5",
  runUrl: "https://github.com/example/repo/actions/runs/9",
  retentionDays: VRT_RETENTION_DAYS,
};

describe("renderComment", () => {
  it("差分・レポート URL・分岐点と head・再実行の PR 番号を書く", () => {
    const body = renderComment(commentBase);
    expect(body).toContain("<!-- vrt-report -->");
    expect(body).toContain("差分が 1 件あります");
    expect(body).toContain("chromium / home: 12 px");
    expect(body).toContain("PR の分岐点 `aaaaaaa`");
    expect(body).toContain("PR の head `bbbbbbb`");
    expect(body).toContain(
      "(https://github.com/example/repo/actions/runs/9/artifacts/5)",
    );
    expect(body).toContain("`vrt-before`");
    expect(body).toContain("`vrt-after`");
    expect(body).toContain("PR 番号に `42`");
    expect(body).toContain(`${String(VRT_RETENTION_DAYS)} 日`);
    expect(body).toContain("マージで消えます");
  });

  it("差分がなければその旨だけ書く", () => {
    const body = renderComment({
      ...commentBase,
      summary: {
        passed: true,
        scenes: [{ ...changedScene, status: "same" }],
      },
    });
    expect(body).toContain("差分はありません。");
    expect(body).not.toContain("chromium / home");
  });

  it("撮影に失敗したときは画像の差分として扱わない", () => {
    const body = renderComment({
      ...commentBase,
      captureFailed: true,
      summary: null,
      reportUrl: "",
    });
    expect(body).toContain("スクリーンショットの取得に失敗しました");
    expect(body).not.toContain("比較レポート");
    expect(body).toContain("PR 番号に `42`");
  });
});

describe("escapeHtml", () => {
  it("HTML の特殊文字を逃がす", () => {
    expect(escapeHtml(`<a href="x">&`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;",
    );
  });
});
