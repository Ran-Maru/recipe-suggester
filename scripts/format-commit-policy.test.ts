import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const cli = path.join(repoRoot, "scripts/format-agent-files.mjs");

type Decision = {
  deny: boolean;
  message: string | null;
  formatBeforeCommit: boolean;
  explicitPaths: string[];
  includeTrackedDirty: boolean;
  includeUntracked: boolean;
  commitCwd: string | null;
};

function analyze(
  command: string,
  aliases?: Record<string, string>,
  files?: Record<string, string>,
): Decision {
  const args = [cli, "--analyze"];
  if (aliases) args.push("--aliases", JSON.stringify(aliases));
  if (files) args.push("--files", JSON.stringify(files));
  args.push("--", command);
  return JSON.parse(execFileSync(process.execPath, args, { encoding: "utf8" }));
}

function runHook(mode: string, payload: unknown): string {
  return execFileSync(process.execPath, [cli, mode], {
    cwd: repoRoot,
    encoding: "utf8",
    input: JSON.stringify(payload),
  });
}

describe("format commit policy", () => {
  it("formats a normal commit, including markdown-only commits", () => {
    const decision = analyze('git commit -m "docs"');
    expect(decision.deny).toBe(false);
    expect(decision.formatBeforeCommit).toBe(true);
  });

  it("does not treat a commit message that mentions --no-verify as a bypass", () => {
    const decision = analyze('git commit -m "do not use --no-verify"');
    expect(decision.deny).toBe(false);
    expect(decision.formatBeforeCommit).toBe(true);
  });

  it("denies hook bypasses that skip vp fmt", () => {
    const denied = [
      'git commit --no-verify -m "docs"',
      'git commit -n -m "docs"',
      'git commit -nm "docs"',
      "VP_GIT_HOOKS=0 git commit -m docs",
      "HUSKY=0 git commit -m docs",
      "VITE_GIT_HOOKS=0 git commit -m docs",
      "export VP_GIT_HOOKS=0",
      "env VP_GIT_HOOKS=0 git commit -m docs",
      "command git commit --no-verify -m docs",
      "git -c core.hooksPath=/dev/null commit -m docs",
      "git -c core.hookspath=/dev/null commit -m docs",
      "git config core.hooksPath /dev/null",
      "git config --unset core.hooksPath",
      "bash -lc 'git commit --no-verify -m docs'",
      "git config alias.c 'commit --no-verify'",
      "git -c alias.foo='commit --no-verify' foo -m docs",
      "python3 -c \"subprocess.run(['git', 'commit', '--no-verify'])\"",
      "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit -m docs",
      "export GIT_CONFIG_KEY_0=core.hooksPath",
      "GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\" git commit -m docs",
      "git config Core.HooksPath /dev/null",
    ];
    for (const command of denied) {
      expect(analyze(command).deny, command).toBe(true);
    }
  });

  it("allows reading hooksPath and a one-shot env var on a non-commit", () => {
    expect(analyze("git config --get core.hooksPath").deny).toBe(false);
    expect(analyze("VP_GIT_HOOKS=0 git status").deny).toBe(false);
    expect(
      analyze(
        "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git status",
      ).deny,
    ).toBe(false);
    expect(analyze("git status").formatBeforeCommit).toBe(false);
  });

  it("sees markdown paths and commit -a / git add -A before the index is updated", () => {
    const added = analyze('git add docs/guide.md && git commit -m "docs"');
    expect(added.formatBeforeCommit).toBe(true);
    expect(added.explicitPaths).toEqual(["docs/guide.md"]);

    const all = analyze('git add -A && git commit -m "docs"');
    expect(all.includeTrackedDirty).toBe(true);
    expect(all.includeUntracked).toBe(true);

    const dashA = analyze('git commit -am "docs"');
    expect(dashA.includeTrackedDirty).toBe(true);
    expect(dashA.includeUntracked).toBe(false);
    expect(analyze('git commit -m "docs" 2>&1').explicitPaths).toEqual([]);
  });

  it("expands aliases and follows git -C", () => {
    expect(analyze("git c -m docs", { c: "commit --no-verify" }).deny).toBe(
      true,
    );
    expect(analyze("git ci -m docs", { ci: "commit" }).formatBeforeCommit).toBe(
      true,
    );
    expect(analyze("git ship", { ship: "!git commit --no-verify" }).deny).toBe(
      true,
    );
    expect(
      analyze("git ship", { ship: "!VP_GIT_HOOKS=0 git commit -m docs" }).deny,
    ).toBe(true);
    expect(
      analyze("git ship", {
        ship: "!GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit -m docs",
      }).deny,
    ).toBe(true);
    expect(analyze("git -C /workspace commit -m docs").commitCwd).toBe(
      "/workspace",
    );
  });

  it("still formats files added in the same command as a message amend", () => {
    const decision = analyze(
      'git add README.md && git commit --amend -m "docs"',
    );
    expect(decision.deny).toBe(false);
    expect(decision.formatBeforeCommit).toBe(true);
    expect(decision.explicitPaths).toEqual(["README.md"]);
    expect(analyze("git commit --amend --no-edit").formatBeforeCommit).toBe(
      false,
    );
    expect(analyze("git commit --amend --no-verify --no-edit").deny).toBe(
      false,
    );
    expect(analyze("git commit --amend --no-verify -F -").deny).toBe(false);
    expect(
      analyze('git add README.md && git commit --amend --no-verify -m "docs"')
        .deny,
    ).toBe(true);
  });

  it("reads a script that hides git commit --no-verify", () => {
    const script = "git commit --no-verify -m docs\n";
    expect(
      analyze("bash commit.sh", undefined, { "commit.sh": script }).deny,
    ).toBe(true);
    expect(
      analyze("./commit.sh", undefined, { "./commit.sh": script }).deny,
    ).toBe(true);
    expect(
      analyze("python3 commit.py", undefined, {
        "commit.py": "subprocess.run(['git', 'commit', '--no-verify'])\n",
      }).deny,
    ).toBe(true);
  });
});

describe("vp fmt before an agent commit", () => {
  const rel = "tmp-format-policy.md";
  const abs = path.join(repoRoot, rel);

  function cleanup() {
    try {
      execFileSync("git", ["reset", "-q", "--", rel], {
        cwd: repoRoot,
        stdio: "ignore",
      });
    } catch {
      // 一度もステージしていないファイルでは reset が失敗する。
    }
    fs.rmSync(abs, { force: true });
  }

  it("formats an unstaged markdown file that git add will include", () => {
    fs.writeFileSync(abs, "# Title\n\n\nhello   \n");
    try {
      const output = runHook("before-commit", {
        command: `git add ${rel} && git commit -m docs`,
        cwd: repoRoot,
      });
      expect(JSON.parse(output).permission).toBe("allow");
      expect(fs.readFileSync(abs, "utf8")).toBe("# Title\n\nhello\n");
      const staged = execFileSync(
        "git",
        ["diff", "--cached", "--name-only", "--", rel],
        {
          cwd: repoRoot,
          encoding: "utf8",
        },
      );
      expect(staged).toBe("");
    } finally {
      cleanup();
    }
  });

  it("rewrites a fully staged markdown blob, not only the worktree", () => {
    fs.writeFileSync(abs, "# Title\n\n\nhello   \n");
    execFileSync("git", ["add", "--", rel], { cwd: repoRoot });
    try {
      const output = runHook("before-commit", {
        command: "git commit -m docs",
        cwd: repoRoot,
      });
      expect(JSON.parse(output).permission).toBe("allow");
      expect(fs.readFileSync(abs, "utf8")).toBe("# Title\n\nhello\n");
      const indexed = execFileSync("git", ["show", `:${rel}`], {
        cwd: repoRoot,
        encoding: "utf8",
      });
      expect(indexed).toBe("# Title\n\nhello\n");
    } finally {
      cleanup();
    }
  });

  it("formats the index of a partially staged markdown file and keeps the unstaged edit", () => {
    fs.writeFileSync(abs, "# Title\n\n\nhello   \n");
    execFileSync("git", ["add", "--", rel], { cwd: repoRoot });
    fs.writeFileSync(abs, "# Title\n\n\nhello   \n\nextra   \n");
    try {
      const output = runHook("before-commit", {
        command: "git commit -m docs",
        cwd: repoRoot,
      });
      expect(JSON.parse(output).permission).toBe("allow");
      const indexed = execFileSync("git", ["show", `:${rel}`], {
        cwd: repoRoot,
        encoding: "utf8",
      });
      expect(indexed).toBe("# Title\n\nhello\n");
      const worktree = fs.readFileSync(abs, "utf8");
      expect(worktree).toContain("extra");
      expect(worktree).not.toContain("hello   ");
      expect(worktree).not.toContain("extra   ");
    } finally {
      cleanup();
    }
  });

  it("leaves ignored agent-skill markdown unformatted", () => {
    const ignored = path.join(repoRoot, ".agents/tmp-format-policy.md");
    const original = "# Title\n\n\nhello   \n";
    fs.writeFileSync(ignored, original);
    try {
      runHook("after-edit", { file_path: ignored, cwd: repoRoot });
      expect(fs.readFileSync(ignored, "utf8")).toBe(original);
    } finally {
      fs.rmSync(ignored, { force: true });
    }
  });

  it("formats markdown written through the edit hook", () => {
    fs.writeFileSync(abs, "# Title\n\n\nhello   \n");
    try {
      runHook("after-edit", { file_path: abs, cwd: repoRoot });
      expect(fs.readFileSync(abs, "utf8")).toBe("# Title\n\nhello\n");
    } finally {
      cleanup();
    }
  });

  it("allows a message-only amend --no-verify on an empty index and denies it when a file is staged", () => {
    const stagedBefore = execFileSync(
      "git",
      ["diff", "--cached", "--name-only"],
      { cwd: repoRoot, encoding: "utf8" },
    );
    expect(stagedBefore).toBe("");
    const allowed = runHook("before-commit", {
      command: "git commit --amend --no-verify --no-edit",
      cwd: repoRoot,
    });
    expect(JSON.parse(allowed).permission).toBe("allow");

    fs.writeFileSync(abs, "# Title\n\n\nhello   \n");
    execFileSync("git", ["add", "--", rel], { cwd: repoRoot });
    try {
      const denied = runHook("before-commit", {
        command: "git commit --amend --no-verify --no-edit",
        cwd: repoRoot,
      });
      expect(JSON.parse(denied).permission).toBe("deny");
      expect(fs.readFileSync(abs, "utf8")).toBe("# Title\n\n\nhello   \n");
    } finally {
      cleanup();
    }
  });

  it("denies a shell script that commits with --no-verify", () => {
    const script = path.join(repoRoot, "tmp-format-policy.sh");
    fs.writeFileSync(script, "#!/bin/bash\ngit commit --no-verify -m docs\n");
    try {
      const output = runHook("before-commit", {
        command: "bash tmp-format-policy.sh",
        cwd: repoRoot,
      });
      expect(JSON.parse(output).permission).toBe("deny");
    } finally {
      fs.rmSync(script, { force: true });
    }
  });
});
