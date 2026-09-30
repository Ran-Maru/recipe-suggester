import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  installReport,
  manifestUrl,
  pruneReports,
  restoreVrtReports,
  type StoredReport,
} from "./pages.ts";

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "vrt-pages-"));
}

function report(overrides: Partial<StoredReport> = {}): StoredReport {
  return {
    runId: "10",
    runAttempt: "1",
    prNumber: 3,
    createdAt: "2026-09-30T00:00:00.000Z",
    passed: true,
    beforeSha: "abc",
    builtAfterSha: "def",
    files: ["index.html"],
    ...overrides,
  };
}

describe("pruneReports", () => {
  it("保持日数を過ぎたレポートを落とす", () => {
    const kept = pruneReports(
      [
        report({ runId: "1", createdAt: "2026-09-01T00:00:00.000Z" }),
        report({ runId: "2", createdAt: "2026-09-28T00:00:00.000Z" }),
      ],
      new Date("2026-09-30T00:00:00.000Z"),
      14,
    );
    expect(kept.map((item) => item.runId)).toEqual(["2"]);
  });
});

const notFoundResponse: typeof fetch = () =>
  Promise.resolve(new Response("missing", { status: 404 }));

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

describe("restoreVrtReports", () => {
  it("404 のときは空の一覧で続ける", async () => {
    const dist = tempDir();
    const manifest = await restoreVrtReports({
      distDir: dist,
      baseUrl: "https://ran-maru.github.io/recipe-suggester",
      fetchImpl: notFoundResponse,
    });
    expect(manifest.reports).toEqual([]);
    expect(readFileSync(path.join(dist, "vrt/index.html"), "utf8")).toContain(
      "レポートはまだありません",
    );
  });

  it("残っているレポートのファイルだけを dist に戻す", async () => {
    const dist = tempDir();
    const base = "https://ran-maru.github.io/recipe-suggester/";
    const files = new Map<string, string>([
      [
        `${base}vrt/manifest.json`,
        JSON.stringify({
          retentionDays: 14,
          reports: [
            report({
              createdAt: "2026-09-29T00:00:00.000Z",
              files: ["index.html"],
            }),
          ],
        }),
      ],
      [`${base}vrt/runs/10/index.html`, "<p>old</p>"],
    ]);
    const fetchImpl: typeof fetch = async (input) => {
      const body = files.get(requestUrl(input));
      if (body === undefined) {
        return new Response("missing", { status: 404 });
      }
      return new Response(body, { status: 200 });
    };
    const manifest = await restoreVrtReports({
      distDir: dist,
      baseUrl: base,
      now: new Date("2026-09-30T00:00:00.000Z"),
      fetchImpl,
    });
    expect(manifest.reports).toHaveLength(1);
    expect(
      readFileSync(path.join(dist, "vrt/runs/10/index.html"), "utf8"),
    ).toBe("<p>old</p>");
  });
});

describe("installReport", () => {
  it("新しいレポートを載せて一覧から古いものを外す", () => {
    const dist = tempDir();
    const source = tempDir();
    mkdirSync(source, { recursive: true });
    writeFileSync(path.join(source, "index.html"), "<p>new</p>");
    installReport({
      distDir: dist,
      reportDir: source,
      now: new Date("2026-09-30T00:00:00.000Z"),
      retentionDays: 14,
      entry: report({
        runId: "11",
        createdAt: "2026-09-30T00:00:00.000Z",
        passed: false,
        files: [],
      }),
    });
    const index = readFileSync(path.join(dist, "vrt/index.html"), "utf8");
    expect(index).toContain("runs/11/index.html");
    expect(index).toContain("差分あり");
    expect(
      readFileSync(path.join(dist, "vrt/runs/11/index.html"), "utf8"),
    ).toBe("<p>new</p>");
  });
});

describe("manifestUrl", () => {
  it("Pages のサブパスを落とさない", () => {
    expect(manifestUrl("https://ran-maru.github.io/recipe-suggester")).toBe(
      "https://ran-maru.github.io/recipe-suggester/vrt/manifest.json",
    );
  });
});
