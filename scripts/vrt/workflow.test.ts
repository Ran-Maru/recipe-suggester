import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { VRT_RETENTION_DAYS } from "./report.ts";

const root = path.resolve(import.meta.dirname, "../..");

function workflow(name: string): string {
  return readFileSync(path.join(root, ".github/workflows", name), "utf8");
}

function script(name: string): string {
  return readFileSync(path.join(root, "scripts/vrt", name), "utf8");
}

describe("VRT ワークフロー", () => {
  it("PR と手動の PR 番号で動き、画像は artifact に置く", () => {
    const yaml = workflow("vrt.yml");
    expect(yaml).toContain("pull_request:");
    expect(yaml).toContain("workflow_dispatch:");
    expect(yaml).toContain("pr_number:");
    expect(yaml).toContain("name: vrt-before");
    expect(yaml).toContain("name: vrt-after");
    expect(yaml).toContain("vrt-output/report/vrt-report.html");
    expect(yaml).toContain("archive: false");
    expect(yaml).toContain(`retention-days: ${String(VRT_RETENTION_DAYS)}`);
    expect(yaml).not.toContain("git add");
  });

  it("結果の URL は同じワークフローが PR に書き、Pages には載せない", () => {
    const yaml = workflow("vrt.yml");
    expect(yaml).toContain("pull-requests: write");
    expect(yaml).toContain("artifact-url");
    expect(yaml).toContain("post-comment.sh");
    expect(
      existsSync(path.join(root, ".github/workflows/vrt-publish.yml")),
    ).toBe(false);
    expect(workflow("gh-pages-deploy.yml")).not.toContain("vrt");
  });

  it("マージされた PR の artifact は別ワークフローが消す", () => {
    const yaml = workflow("vrt-cleanup.yml");
    expect(yaml).toContain("types: [closed]");
    expect(yaml).toContain("github.event.pull_request.merged == true");
    expect(yaml).toContain("actions: write");
    expect(yaml).toContain("cleanup.sh");
    expect(script("cleanup.sh")).toContain("actions/artifacts/");
  });
});

describe("VRT スクリプト", () => {
  it("コメントは -F でファイルから読む（-f は @ を展開しない）", () => {
    const sh = script("post-comment.sh");
    expect(sh).toContain('-F "body=@${body_file}"');
    expect(sh).not.toContain('-f "body=');
  });

  it("変更前は head と base の merge-base にする", () => {
    const sh = script("prepare-checkouts.sh");
    expect(sh).toContain('git merge-base "$base_sha" "$head_sha"');
    expect(sh).not.toContain("git merge --no-edit");
  });
});
