import { describe, expect, it } from "vite-plus/test";
import { decideShas, parsePullRequestView } from "./resolve-pr.ts";

const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const head = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const merge = "cccccccccccccccccccccccccccccccccccccccc";

describe("decideShas", () => {
  it("開いている PR は base と head を返す", () => {
    const plan = decideShas({
      eventName: "pull_request",
      prNumber: 7,
      repository: "ran-maru/recipe-suggester",
      pullRequestUrl: "https://github.com/ran-maru/recipe-suggester/pull/7",
      baseSha: sha,
      headSha: head,
    });
    expect(plan.mode).toBe("open");
    expect(plan.beforeSha).toBe(sha);
    expect(plan.headSha).toBe(head);
    expect(plan.mergeCommitSha).toBe("");
  });

  it("マージ済み PR はマージコミットを返す", () => {
    const plan = decideShas({
      eventName: "workflow_dispatch",
      prNumber: 7,
      repository: "ran-maru/recipe-suggester",
      view: {
        state: "MERGED",
        url: "https://github.com/ran-maru/recipe-suggester/pull/7",
        baseRefOid: sha,
        headRefOid: head,
        mergeCommitOid: merge,
      },
    });
    expect(plan.mode).toBe("merged");
    expect(plan.mergeCommitSha).toBe(merge);
    expect(plan.beforeSha).toBe("");
  });

  it("手動実行でも未マージなら今の base と head を使う", () => {
    const plan = decideShas({
      eventName: "workflow_dispatch",
      prNumber: 7,
      repository: "ran-maru/recipe-suggester",
      view: {
        state: "OPEN",
        url: "https://github.com/ran-maru/recipe-suggester/pull/7",
        baseRefOid: sha,
        headRefOid: head,
        mergeCommitOid: null,
      },
    });
    expect(plan.mode).toBe("open");
    expect(plan.beforeSha).toBe(sha);
    expect(plan.headSha).toBe(head);
  });

  it("PR 番号が不正なら止める", () => {
    expect(() =>
      decideShas({
        eventName: "workflow_dispatch",
        prNumber: 0,
        repository: "ran-maru/recipe-suggester",
      }),
    ).toThrow(/PR 番号/);
  });
});

describe("parsePullRequestView", () => {
  it("gh pr view の JSON を読む", () => {
    const view = parsePullRequestView(
      JSON.stringify({
        state: "MERGED",
        url: "https://github.com/ran-maru/recipe-suggester/pull/7",
        baseRefOid: sha,
        headRefOid: head,
        mergeCommit: { oid: merge },
      }),
    );
    expect(view.mergeCommitOid).toBe(merge);
  });
});
