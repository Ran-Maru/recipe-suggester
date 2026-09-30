import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import {
  OPT_OUT_LABEL,
  additionsOnly,
  classifyRecipeDiff,
  parseNameStatus,
  selectFromPayload,
} from "./recipe-additions-only.ts";

const repo = "Ran-Maru/recipe-suggester";
const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);

function recipe(title: string, memo = "") {
  return {
    title,
    kana: "てすと",
    url: `https://example.com/${title}`,
    memo,
  };
}

function original(id: string, paragraph: string) {
  return {
    id,
    title: id,
    kana: "てすと",
    memo: "",
    paragraphs: [paragraph],
  };
}

function pullRequest(
  patch: {
    draft?: boolean;
    state?: string;
    author?: string;
    labels?: { name: string }[];
    headSha?: string;
    headRef?: string;
    baseRef?: string;
    headRepo?: string | null;
    baseRepo?: string | null;
    number?: number;
  } = {},
) {
  return {
    number: patch.number ?? 10,
    state: patch.state ?? "open",
    draft: patch.draft ?? false,
    author_association: patch.author ?? "OWNER",
    labels: patch.labels ?? [],
    base: {
      ref: patch.baseRef ?? "main",
      sha: baseSha,
      repo: {
        full_name: patch.baseRepo === undefined ? repo : patch.baseRepo,
      },
    },
    head: {
      ref: patch.headRef ?? "add-recipe",
      sha: patch.headSha ?? headSha,
      repo:
        patch.headRepo === null ? null : { full_name: patch.headRepo ?? repo },
    },
  };
}

describe("additionsOnly", () => {
  it("末尾への追加を認める", () => {
    const decision = additionsOnly(
      [recipe("既存")],
      [recipe("既存"), recipe("新規")],
    );
    expect(decision.ok).toBe(true);
  });

  it("途中への挿入を認める", () => {
    const decision = additionsOnly(
      [recipe("先"), recipe("後")],
      [recipe("先"), recipe("中"), recipe("後")],
    );
    expect(decision.ok).toBe(true);
  });

  it("キーの並びが違っても既存要素は同一とみなす", () => {
    const base = [{ title: "既存", url: "https://example.com/a" }];
    const head = [
      { url: "https://example.com/a", title: "既存" },
      { title: "新規", url: "https://example.com/b" },
    ];
    expect(additionsOnly(base, head).ok).toBe(true);
  });

  it("既存要素の修正は拒否する", () => {
    const decision = additionsOnly(
      [recipe("既存", "")],
      [recipe("既存", "メモ"), recipe("新規")],
    );
    expect(decision).toEqual({
      ok: false,
      reason: "既存の 1 件目が残っていません",
    });
  });

  it("削除して別の要素を足すのは拒否する", () => {
    const decision = additionsOnly(
      [recipe("残す"), recipe("消す")],
      [recipe("残す"), recipe("新規")],
    );
    expect(decision.ok).toBe(false);
  });

  it("並べ替えは拒否する", () => {
    expect(
      additionsOnly([recipe("先"), recipe("後")], [recipe("後"), recipe("先")])
        .ok,
    ).toBe(false);
  });

  it("追加がなければ拒否する", () => {
    expect(additionsOnly([recipe("既存")], [recipe("既存")])).toEqual({
      ok: false,
      reason: "追加がありません",
    });
  });

  it("配列でなければ拒否する", () => {
    expect(additionsOnly({}, [])).toEqual({
      ok: false,
      reason: "ルートが配列ではありません",
    });
  });

  it("先頭を書き換えて元の要素を後ろに残しても拒否する", () => {
    const decision = additionsOnly(
      [recipe("既存"), recipe("次")],
      [recipe("改変"), recipe("次"), recipe("既存")],
    );
    expect(decision.ok).toBe(false);
  });

  it("オリジナルレシピの本文追加を新しい要素として認める", () => {
    const decision = additionsOnly(
      [original("gyoza", "既存")],
      [original("gyoza", "既存"), original("pasta", "新規")],
    );
    expect(decision.ok).toBe(true);
  });

  it("オリジナルレシピの本文の修正は拒否する", () => {
    expect(
      additionsOnly(
        [original("gyoza", "既存")],
        [original("gyoza", "変更"), original("pasta", "新規")],
      ).ok,
    ).toBe(false);
  });
});

describe("classifyRecipeDiff", () => {
  const files = new Map<string, string>([
    ["base:src/mapping.json", JSON.stringify([recipe("既存")])],
    ["head:src/mapping.json", JSON.stringify([recipe("既存"), recipe("新規")])],
  ]);

  function readFile(rev: string, filePath: string): string {
    const text = files.get(`${rev}:${filePath}`);
    if (text === undefined) {
      throw new Error(`missing ${rev}:${filePath}`);
    }
    return text;
  }

  it("mapping.json への追加だけを認める", () => {
    const decision = classifyRecipeDiff(
      [{ status: "M", path: "src/mapping.json" }],
      readFile,
      "base",
      "head",
    );
    expect(decision.ok).toBe(true);
  });

  it("レシピ以外のファイルがあれば拒否する", () => {
    const decision = classifyRecipeDiff(
      [
        { status: "M", path: "src/mapping.json" },
        { status: "M", path: "cspell.json" },
      ],
      readFile,
      "base",
      "head",
    );
    expect(decision).toEqual({
      ok: false,
      reason: "レシピ以外のファイルが変わっています: cspell.json",
    });
  });

  it("ファイルの新設は拒否する", () => {
    expect(
      classifyRecipeDiff(
        [{ status: "A", path: "src/mapping.json" }],
        readFile,
        "base",
        "head",
      ).ok,
    ).toBe(false);
  });

  it("変更がなければ拒否する", () => {
    expect(classifyRecipeDiff([], readFile, "base", "head")).toEqual({
      ok: false,
      reason: "変更がありません",
    });
  });

  it("JSON でなければ拒否する", () => {
    const decision = classifyRecipeDiff(
      [{ status: "M", path: "src/mapping.json" }],
      () => "{",
      "base",
      "head",
    );
    expect(decision.ok).toBe(false);
  });
});

describe("parseNameStatus", () => {
  it("NUL 区切りの変更を読む", () => {
    expect(parseNameStatus("M\0src/mapping.json\0")).toEqual([
      { status: "M", path: "src/mapping.json" },
    ]);
  });

  it("名前変更は拒否する", () => {
    expect(() => parseNameStatus("R100\0old\0new\0")).toThrow(/名前変更/);
  });
});

describe("selectFromPayload", () => {
  it("条件を満たす PR を選ぶ", () => {
    const decision = selectFromPayload([pullRequest()], headSha, repo);
    expect(decision).toMatchObject({
      skip: false,
      number: 10,
      baseSha,
      headSha,
      headRef: "add-recipe",
    });
  });

  it("リポジトリ名の大文字小文字は無視する", () => {
    const decision = selectFromPayload(
      [pullRequest()],
      headSha,
      "ran-maru/recipe-suggester",
    );
    expect(decision.skip).toBe(false);
  });

  it("下書きはマージしない", () => {
    const decision = selectFromPayload(
      [pullRequest({ draft: true })],
      headSha,
      repo,
    );
    expect(decision).toMatchObject({
      skip: true,
      reason: expect.stringContaining("下書き") as unknown,
    });
  });

  it("フォークはマージしない", () => {
    const decision = selectFromPayload(
      [pullRequest({ headRepo: "other/recipe-suggester" })],
      headSha,
      repo,
    );
    expect(decision).toMatchObject({
      skip: true,
      reason: expect.stringContaining("フォーク") as unknown,
    });
  });

  it("オプトアウトのラベルがある PR はマージしない", () => {
    const decision = selectFromPayload(
      [pullRequest({ labels: [{ name: OPT_OUT_LABEL }] })],
      headSha,
      repo,
    );
    expect(decision.skip).toBe(true);
  });

  it("書き込み権限のない作者はマージしない", () => {
    const decision = selectFromPayload(
      [pullRequest({ author: "CONTRIBUTOR" })],
      headSha,
      repo,
    );
    expect(decision.skip).toBe(true);
  });

  it("閉じた PR はマージしない", () => {
    expect(
      selectFromPayload([pullRequest({ state: "closed" })], headSha, repo).skip,
    ).toBe(true);
  });

  it("先頭が違うコミットは対象外", () => {
    expect(
      selectFromPayload(
        [pullRequest({ headSha: "c".repeat(40) })],
        headSha,
        repo,
      ).skip,
    ).toBe(true);
  });

  it("候補が複数あるときはマージしない", () => {
    const decision = selectFromPayload(
      [pullRequest({ number: 1 }), pullRequest({ number: 2 })],
      headSha,
      repo,
    );
    expect(decision.skip).toBe(true);
  });

  it("配列でなければ失敗する", () => {
    expect(() => selectFromPayload({}, headSha, repo)).toThrow(/配列/);
  });
});

describe("workflow name", () => {
  it("CI のワークフロー名を参照している", () => {
    const ci = readFileSync(
      new URL("../.github/workflows/ci.yml", import.meta.url),
      "utf8",
    );
    const autoMerge = readFileSync(
      new URL("../.github/workflows/recipe-auto-merge.yml", import.meta.url),
      "utf8",
    );
    const matched = /^name: (.+)$/m.exec(ci);
    expect(matched?.[1]).toBe("Tests & Dependabot Auto Merge");
    expect(autoMerge).toContain('"Tests & Dependabot Auto Merge"');
    expect(autoMerge).toContain("actions/checkout@v7");
    expect(autoMerge).toContain("ref: main");
  });
});
