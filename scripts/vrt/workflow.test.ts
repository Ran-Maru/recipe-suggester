import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { VRT_RETENTION_DAYS } from "./report.ts";

const workflows = path.resolve(import.meta.dirname, "../../.github/workflows");

function workflow(name: string): string {
  return readFileSync(path.join(workflows, name), "utf8");
}

describe("VRT ワークフロー", () => {
  it("PR と手動の PR 番号で動き、画像は artifact に置く", () => {
    const yaml = workflow("vrt.yml");
    expect(yaml).toContain("pull_request:");
    expect(yaml).toContain("workflow_dispatch:");
    expect(yaml).toContain("pr_number:");
    expect(yaml).toContain("name: vrt-before");
    expect(yaml).toContain("name: vrt-after");
    expect(yaml).toContain("name: vrt-diff");
    expect(yaml).toContain("name: vrt-report");
    expect(yaml).toContain(`retention-days: ${String(VRT_RETENTION_DAYS)}`);
    expect(yaml).not.toContain("git add");
  });

  it("結果の URL は別ワークフローが PR に書く", () => {
    const yaml = workflow("vrt-publish.yml");
    expect(yaml).toContain('workflows: ["Visual Regression"]');
    expect(yaml).toContain("workflow_run:");
    expect(yaml).toContain("actions/deploy-pages@v5");
    expect(yaml).toContain("post-comment.sh");
  });

  it("本番の Pages デプロイは既存レポートを消さない", () => {
    expect(workflow("gh-pages-deploy.yml")).toContain(
      "scripts/vrt/restore-vrt-reports.ts",
    );
  });
});
