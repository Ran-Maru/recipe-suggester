import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const denyShell = path.join(
  repoRoot,
  ".cursor/hooks/deny-dangerous-commands.sh",
);
const denyEdit = path.join(repoRoot, ".cursor/hooks/deny-outside-worktree.sh");
const cwd = process.cwd();

function decideCommand(command: string) {
  const output = execFileSync("bash", [denyShell], {
    encoding: "utf8",
    input: JSON.stringify({ command, cwd }),
  });
  return JSON.parse(output) as { permission: string };
}

function decidePath(filePath: string) {
  const output = execFileSync("bash", [denyEdit], {
    encoding: "utf8",
    input: JSON.stringify({
      tool_name: "Write",
      tool_input: { path: filePath },
      cwd,
    }),
  });
  return JSON.parse(output) as { permission: string };
}

describe("dangerous-command-policy", () => {
  it("denies bare force push and hard reset", () => {
    expect(decideCommand("git push --force").permission).toBe("deny");
    expect(decideCommand("git push -f origin main").permission).toBe("deny");
    expect(decideCommand("git push origin +main").permission).toBe("deny");
    expect(decideCommand("git reset --hard HEAD").permission).toBe("deny");
    expect(decideCommand("GIT_DIR=.git git reset --hard HEAD").permission).toBe(
      "deny",
    );
  });

  it("allows force-with-lease and ordinary git clean -fd", () => {
    expect(decideCommand("git push --force-with-lease").permission).toBe(
      "allow",
    );
    expect(decideCommand("git clean -fd").permission).toBe("allow");
  });

  it("denies git clean that also removes ignored files", () => {
    expect(decideCommand("git clean -fdx").permission).toBe("deny");
    expect(decideCommand("git clean -fdX").permission).toBe("deny");
  });

  it("allows ordinary git commands", () => {
    expect(decideCommand("git status").permission).toBe("allow");
    expect(decideCommand("git reset HEAD").permission).toBe("allow");
    expect(decideCommand("git restore src/copyUrl.ts").permission).toBe(
      "allow",
    );
    expect(decideCommand("git push origin HEAD").permission).toBe("allow");
  });

  it("denies discarding the whole worktree", () => {
    expect(decideCommand("git checkout -- .").permission).toBe("deny");
    expect(decideCommand("git restore .").permission).toBe("deny");
    expect(decideCommand("git restore --worktree .").permission).toBe("deny");
    expect(decideCommand("git restore --source=HEAD .").permission).toBe(
      "deny",
    );
  });

  it("allows everyday recursive rm and denies only irreversible targets", () => {
    expect(decideCommand("rm -rf node_modules").permission).toBe("allow");
    expect(decideCommand('rm -rf "node_modules"').permission).toBe("allow");
    expect(decideCommand("rm -rf tmp").permission).toBe("allow");
    expect(decideCommand("rm -rf node_modules/.vite").permission).toBe("allow");
    expect(decideCommand("rm -rf dist").permission).toBe("allow");
    expect(
      decideCommand("rm -rf /tmp/recipe-suggester-outside").permission,
    ).toBe("allow");
    expect(decideCommand("rm -rf /").permission).toBe("deny");
    expect(decideCommand("rm -rf .git").permission).toBe("deny");
    expect(decideCommand("rm -rf src").permission).toBe("deny");
    expect(decideCommand("rm -rf src/copyUrl.ts").permission).toBe("deny");
    expect(decideCommand("rm -rf .").permission).toBe("deny");
  });

  it("denies chmod 777, allows cp to /tmp, and denies mv outside the worktree", () => {
    expect(decideCommand("chmod 777 src/copyUrl.ts").permission).toBe("deny");
    expect(decideCommand("chmod -R 777 .").permission).toBe("deny");
    expect(decideCommand("chmod +x scripts/worktree-ports.ts").permission).toBe(
      "allow",
    );
    expect(decideCommand("cp src/copyUrl.ts /tmp/copyUrl.ts").permission).toBe(
      "allow",
    );
    expect(decideCommand("mv src/copyUrl.ts /tmp/copyUrl.ts").permission).toBe(
      "deny",
    );
  });

  it("denies chained destructive commands", () => {
    expect(decideCommand("git status && git reset --hard").permission).toBe(
      "deny",
    );
  });

  it("denies file edits outside the worktree and under .git", () => {
    expect(decidePath("src/copyUrl.ts").permission).toBe("allow");
    expect(decidePath("/tmp/outside.ts").permission).toBe("deny");
    expect(decidePath(".git/config").permission).toBe("deny");
  });
});
