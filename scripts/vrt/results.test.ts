import { describe, expect, it } from "vite-plus/test";
import { classify, parseResults, renderComment } from "./results.ts";

const ESC = String.fromCharCode(27);

function test(
  projectName: string,
  status: string,
  message?: string,
): Record<string, unknown> {
  return {
    projectName,
    status,
    results: [
      {
        status: status === "expected" ? "passed" : "failed",
        errors: message ? [{ message }] : [],
      },
    ],
  };
}

function report(tests: [string, string, string, string?][]): string {
  return JSON.stringify({
    suites: [
      {
        title: "vrt.spec.ts",
        suites: [
          {
            title: "見た目",
            specs: tests.map(([title, project, status, message]) => ({
              title,
              tests: [test(project, status, message)],
            })),
          },
        ],
      },
    ],
  });
}

const resizedMessage = `Error: ${ESC}[2mexpect(${ESC}[22m${ESC}[31mpage${ESC}[39m${ESC}[2m).${ESC}[22mtoHaveScreenshot${ESC}[2m(${ESC}[22m${ESC}[32mexpected${ESC}[39m${ESC}[2m)${ESC}[22m failed\n\n  Expected an image 1280px by 720px, received 1280px by 721px. 4154 pixels (ratio 0.01 of all image pixels) are different.`;
const changedMessage =
  "Error: expect(page).toHaveScreenshot(expected) failed\n\n  12 pixels (ratio 0.00 of all image pixels) are different.";

describe("classify", () => {
  it("基準画像がない画面は added にする", () => {
    expect(
      classify("A snapshot doesn't exist at /x/home.png, writing actual.")
        .status,
    ).toBe("added");
  });

  it("サイズ違いは画素数より先に見る", () => {
    expect(classify(resizedMessage)).toEqual({
      status: "resized",
      diffPixels: null,
      detail: "サイズが違う（1280×720 → 1280×721）",
    });
  });

  it("画素の差分は件数を読む", () => {
    expect(classify(changedMessage)).toEqual({
      status: "changed",
      diffPixels: 12,
      detail: "差分あり（12 px）",
    });
    expect(
      classify("1 pixel (ratio 0.00 of all image pixels) is different.")
        .diffPixels,
    ).toBe(1);
  });

  it("読めない原因は最初の行を残す", () => {
    expect(classify("\n  Timeout 60000ms exceeded.\nmore").detail).toBe(
      "撮影に失敗: Timeout 60000ms exceeded.",
    );
  });
});

describe("parseResults", () => {
  it("すべて expected なら passed", () => {
    const summary = parseResults(
      report([
        ["home", "chromium", "expected"],
        ["recipes", "chromium", "expected"],
      ]),
    );
    expect(summary?.passed).toBe(true);
    expect(summary?.scenes.map((scene) => scene.status)).toEqual([
      "same",
      "same",
    ]);
  });

  it("失敗した画面を分類し、ANSI を外し、project と名前で並べる", () => {
    const summary = parseResults(
      report([
        ["recipes", "chromium", "unexpected", changedMessage],
        ["home", "Mobile Safari", "unexpected", resizedMessage],
        ["home", "chromium", "expected"],
        ["skip", "chromium", "skipped"],
      ]),
    );
    expect(summary?.passed).toBe(false);
    expect(
      summary?.scenes.map((scene) => [scene.project, scene.name, scene.status]),
    ).toEqual([
      ["chromium", "home", "same"],
      ["chromium", "recipes", "changed"],
      ["Mobile Safari", "home", "resized"],
    ]);
  });

  it("画面が 1 つもなければ passed にしない", () => {
    expect(parseResults(JSON.stringify({ suites: [] }))?.passed).toBe(false);
  });
});

describe("renderComment", () => {
  const base = {
    prNumber: 7,
    beforeSha: "a".repeat(40),
    headSha: "b".repeat(40),
    captureFailed: false,
    reportUrl: "https://vrt.example.workers.dev/pr-7/1/index.html",
    runUrl: "https://github.com/o/r/actions/runs/1",
    retentionDays: 14,
  };

  it("差分なしでもレポートと再実行の案内を載せる", () => {
    const body = renderComment({
      ...base,
      summary: parseResults(report([["home", "chromium", "expected"]])),
    });
    expect(body).toContain("<!-- vrt-report -->");
    expect(body).toContain("差分はありません。");
    expect(body).toContain("`aaaaaaa`");
    expect(body).toContain("`bbbbbbb`");
    expect(body).toContain("[比較レポートを開く](https://vrt.example");
    expect(body).toContain("14 日");
    expect(body).toContain("`7`");
  });

  it("差分は 8 件まで並べ、残りは件数にする", () => {
    const tests = Array.from(
      { length: 10 },
      (_, index): [string, string, string, string] => [
        `scene-${String(index).padStart(2, "0")}`,
        "chromium",
        "unexpected",
        changedMessage,
      ],
    );
    const body = renderComment({
      ...base,
      summary: parseResults(report(tests)),
    });
    expect(body).toContain("差分が 10 件あります。");
    expect(body).toContain("- chromium / scene-07:");
    expect(body).not.toContain("scene-08");
    expect(body).toContain("- ほか 2 件");
  });

  it("撮影に失敗したときはその旨を書く", () => {
    const body = renderComment({
      ...base,
      captureFailed: true,
      summary: null,
      reportUrl: "",
    });
    expect(body).toContain("スクリーンショットの取得に失敗しました。");
    expect(body).not.toContain("比較レポートを開く");
  });
});
