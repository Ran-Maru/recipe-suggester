import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vite-plus/test";
import {
  VRT_RETENTION_DAYS,
  compareDirectories,
  escapeHtml,
  renderComment,
  reportPageUrl,
  type VrtMeta,
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

const meta: VrtMeta = {
  prNumber: 42,
  prUrl: "https://github.com/example/recipe-suggester/pull/42",
  mode: "open",
  beforeSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  builtAfterSha: "cccccccccccccccccccccccccccccccccccccccc",
  captureFailed: false,
  passed: false,
};

describe("compareDirectories", () => {
  it("同じ画像は差分なしになる", () => {
    const root = tempDir();
    writePng(path.join(root, "before/chromium/home.png"), 2, 2, 10);
    writePng(path.join(root, "after/chromium/home.png"), 2, 2, 10);
    const summary = compareDirectories(
      path.join(root, "before"),
      path.join(root, "after"),
      path.join(root, "report"),
    );
    expect(summary.passed).toBe(true);
    expect(summary.scenes[0]?.status).toBe("same");
    expect(
      readFileSync(path.join(root, "report/index.html"), "utf8"),
    ).toContain("差分はありません");
  });

  it("1 px でも違えば差分ありになる", () => {
    const root = tempDir();
    writePng(path.join(root, "before/chromium/home.png"), 2, 2, 10);
    writePng(path.join(root, "after/chromium/home.png"), 2, 2, 200);
    const summary = compareDirectories(
      path.join(root, "before"),
      path.join(root, "after"),
      path.join(root, "report"),
      { prNumber: 42 },
    );
    expect(summary.passed).toBe(false);
    expect(summary.scenes[0]?.status).toBe("changed");
    expect(summary.scenes[0]?.diffPixels).toBeGreaterThan(0);
    expect(
      readFileSync(
        path.join(root, "report/images/chromium/home/diff.png"),
      ).subarray(0, 8),
    ).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it("サイズが違う画面は失敗にする", () => {
    const root = tempDir();
    writePng(path.join(root, "before/mobile-chrome/recipes.png"), 2, 2, 10);
    writePng(path.join(root, "after/mobile-chrome/recipes.png"), 3, 2, 10);
    const summary = compareDirectories(
      path.join(root, "before"),
      path.join(root, "after"),
      path.join(root, "report"),
    );
    expect(summary.scenes[0]?.status).toBe("resized");
    expect(summary.passed).toBe(false);
  });

  it("片側にしかない画像と、パスが不正な画像は失敗または無視する", () => {
    const root = tempDir();
    writePng(path.join(root, "before/chromium/home.png"), 2, 2, 10);
    writePng(path.join(root, "after/chromium/added.png"), 2, 2, 10);
    mkdirSync(path.join(root, "before/../outside"), { recursive: true });
    writePng(path.join(root, "before/not-a-pair.png"), 2, 2, 1);
    const summary = compareDirectories(
      path.join(root, "before"),
      path.join(root, "after"),
      path.join(root, "report"),
    );
    const statuses = summary.scenes.map((scene) => scene.status).toSorted();
    expect(statuses).toEqual(["added", "removed"]);
    expect(summary.passed).toBe(false);
  });
});

describe("renderComment", () => {
  it("差分・URL・再実行の PR 番号を書く", () => {
    const body = renderComment({
      meta,
      summary: {
        passed: false,
        maxDiffPixels: 0,
        scenes: [
          {
            project: "chromium",
            name: "home",
            status: "changed",
            diffPixels: 12,
            before: { width: 2, height: 2 },
            after: { width: 2, height: 2 },
            detail: "差分あり（12 px）",
          },
        ],
      },
      reportUrl:
        "https://ran-maru.github.io/recipe-suggester/vrt/runs/9/index.html",
      runUrl: "https://github.com/example/recipe-suggester/actions/runs/9",
      retentionDays: VRT_RETENTION_DAYS,
    });
    expect(body).toContain("<!-- vrt-report -->");
    expect(body).toContain("差分が 1 件あります");
    expect(body).toContain("chromium / home: 12 px");
    expect(body).toContain("vrt/runs/9/index.html");
    expect(body).toContain("`vrt-before`");
    expect(body).toContain("`vrt-after`");
    expect(body).toContain("`vrt-diff`");
    expect(body).toContain("PR 番号に `42`");
    expect(body).toContain(`${String(VRT_RETENTION_DAYS)} 日で消えます`);
  });

  it("撮影に失敗したときは画像の差分として扱わない", () => {
    const body = renderComment({
      meta: { ...meta, captureFailed: true, passed: false },
      summary: null,
      reportUrl: "",
      runUrl: "https://github.com/example/recipe-suggester/actions/runs/9",
      retentionDays: VRT_RETENTION_DAYS,
    });
    expect(body).toContain("スクリーンショットの取得に失敗しました");
    expect(body).not.toContain("比較結果を開く");
    expect(body).toContain("PR 番号に `42`");
  });
});

describe("reportPageUrl", () => {
  it("リポジトリのパスを残してレポート URL を作る", () => {
    expect(
      reportPageUrl("https://ran-maru.github.io/recipe-suggester", "15"),
    ).toBe(
      "https://ran-maru.github.io/recipe-suggester/vrt/runs/15/index.html",
    );
  });
});

describe("escapeHtml", () => {
  it("HTML の特殊文字を逃がす", () => {
    expect(escapeHtml(`<a href="x">&`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;",
    );
  });
});
