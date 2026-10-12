import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

const scriptPath = path.resolve(
  import.meta.dirname,
  "merge-recipe-additions-pr.sh",
);
const repo = "Ran-Maru/recipe-suggester";

function git(cwd: string, args: readonly string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  }).trim();
}

function mapping(titles: readonly string[]): string {
  return `${JSON.stringify(
    titles.map((title) => ({
      title,
      kana: "てすと",
      url: `https://example.com/${title}`,
      memo: "",
    })),
    null,
    2,
  )}\n`;
}

type Fixture = {
  root: string;
  work: string;
  baseSha: string;
  headSha: string;
  headRef: string;
};

function createFixture(writeHead: (work: string) => void): Fixture {
  const root = mkdtempSync(path.join(tmpdir(), "recipe-merge-"));
  const work = path.join(root, "work");
  const origin = path.join(root, "origin.git");
  mkdirSync(path.join(work, "src"), { recursive: true });
  git(work, ["init", "-b", "main"]);
  writeFileSync(path.join(work, "src/mapping.json"), mapping(["既存"]));
  git(work, ["add", "src/mapping.json"]);
  git(work, ["commit", "-m", "base"]);
  git(work, ["init", "--bare", "-b", "main", origin]);
  git(work, ["remote", "add", "origin", origin]);
  git(work, ["push", "origin", "main"]);
  const baseSha = git(work, ["rev-parse", "HEAD"]);
  git(work, ["checkout", "-b", "add-recipe"]);
  writeHead(work);
  git(work, ["add", "-A"]);
  git(work, ["commit", "-m", "head"]);
  git(work, ["push", "origin", "add-recipe"]);
  const headSha = git(work, ["rev-parse", "HEAD"]);
  return { root, work, baseSha, headSha, headRef: "add-recipe" };
}

function pull(fixture: Fixture, patch: Record<string, unknown> = {}) {
  return {
    number: 10,
    state: "open",
    draft: false,
    author_association: "OWNER",
    labels: [],
    base: {
      ref: "main",
      sha: fixture.baseSha,
      repo: { full_name: repo },
    },
    head: {
      ref: fixture.headRef,
      sha: fixture.headSha,
      repo: { full_name: repo },
    },
    ...patch,
  };
}

function readLog(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function run(
  fixture: Fixture,
  pulls: unknown,
  options: { mergeExit?: number; prState?: string } = {},
) {
  const bin = path.join(fixture.root, "bin");
  mkdirSync(bin);
  const pullsFile = path.join(fixture.root, "pulls.json");
  const mergeLog = path.join(fixture.root, "merge.log");
  const dispatchLog = path.join(fixture.root, "dispatch.log");
  writeFileSync(pullsFile, JSON.stringify(pulls));
  writeFileSync(
    path.join(bin, "gh"),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "api" ]]; then
  url="\${2:-}"
  if [[ "$url" == *"/commits/"*"/pulls" ]]; then
    cat "\${PULLS_FILE:?}"
    exit 0
  fi
  printf 'unexpected api %s\\n' "$url" >&2
  exit 1
fi
if [[ "\${1:-}" == "pr" && "\${2:-}" == "merge" ]]; then
  printf '%s\\n' "$*" >> "\${MERGE_LOG:?}"
  exit "\${MERGE_EXIT:-0}"
fi
if [[ "\${1:-}" == "pr" && "\${2:-}" == "view" ]]; then
  printf '%s\\n' "\${PR_STATE:?}"
  exit 0
fi
if [[ "\${1:-}" == "workflow" && "\${2:-}" == "run" ]]; then
  printf '%s\\n' "$*" >> "\${DISPATCH_LOG:?}"
  exit 0
fi
printf 'unexpected gh %s\\n' "$*" >&2
exit 1
`,
  );
  chmodSync(path.join(bin, "gh"), 0o755);
  const result = spawnSync("bash", [scriptPath], {
    cwd: fixture.work,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      HEAD_SHA: fixture.headSha,
      REPO: repo,
      GH_TOKEN: "fake",
      PULLS_FILE: pullsFile,
      MERGE_LOG: mergeLog,
      DISPATCH_LOG: dispatchLog,
      ...(options.mergeExit === undefined
        ? {}
        : { MERGE_EXIT: String(options.mergeExit) }),
      ...(options.prState === undefined ? {} : { PR_STATE: options.prState }),
    },
  });
  return {
    result,
    merged: readLog(mergeLog),
    dispatched: readLog(dispatchLog),
  };
}

function appendRecipe(work: string) {
  writeFileSync(path.join(work, "src/mapping.json"), mapping(["既存", "新規"]));
}

describe("merge-recipe-additions-pr.sh", () => {
  it("レシピ追加だけなら squash マージする", () => {
    const fixture = createFixture(appendRecipe);
    try {
      const { result, merged, dispatched } = run(fixture, [pull(fixture)]);
      expect(result.status, result.stderr).toBe(0);
      expect(merged).toContain("pr merge 10");
      expect(dispatched).toContain(
        `workflow run ci.yml --repo ${repo} --ref main`,
      );
      expect(merged).toContain("--squash");
      expect(merged).toContain(`--match-head-commit ${fixture.headSha}`);
      expect(result.stdout).toContain("マージします");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("マージ済みなら CI の起動まで進む", () => {
    const fixture = createFixture(appendRecipe);
    try {
      const { result, merged, dispatched } = run(fixture, [pull(fixture)], {
        mergeExit: 1,
        prState: "MERGED",
      });
      expect(result.status, result.stderr).toBe(0);
      expect(merged).toContain("pr merge 10");
      expect(dispatched).toContain(
        `workflow run ci.yml --repo ${repo} --ref main`,
      );
      expect(result.stdout).toContain("マージ済み");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("マージに失敗し、まだ開いているときは CI を起動しない", () => {
    const fixture = createFixture(appendRecipe);
    try {
      const { result, dispatched } = run(fixture, [pull(fixture)], {
        mergeExit: 1,
        prState: "OPEN",
      });
      expect(result.status).not.toBe(0);
      expect(dispatched).toBe("");
      expect(result.stderr).toContain("マージできませんでした");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("レシピ以外のファイルがあればマージしない", () => {
    const fixture = createFixture((work) => {
      appendRecipe(work);
      writeFileSync(path.join(work, "README.md"), "extra\n");
    });
    try {
      const { result, merged, dispatched } = run(fixture, [pull(fixture)]);
      expect(result.status, result.stderr).toBe(0);
      expect(merged).toBe("");
      expect(dispatched).toBe("");
      expect(result.stderr).toContain("レシピ以外のファイル");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("既存レシピの修正はマージしない", () => {
    const fixture = createFixture((work) => {
      writeFileSync(
        path.join(work, "src/mapping.json"),
        mapping(["既存の名前を変えた", "新規"]),
      );
    });
    try {
      const { result, merged, dispatched } = run(fixture, [pull(fixture)]);
      expect(result.status, result.stderr).toBe(0);
      expect(merged).toBe("");
      expect(dispatched).toBe("");
      expect(result.stderr).toContain("残っていません");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("下書きはマージしない", () => {
    const fixture = createFixture(appendRecipe);
    try {
      const { result, merged } = run(fixture, [pull(fixture, { draft: true })]);
      expect(result.status, result.stderr).toBe(0);
      expect(merged).toBe("");
      expect(result.stderr).toContain("下書き");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
