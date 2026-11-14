import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  commitSubject,
  isAlreadyMigrated,
  readCatalogVersion,
} from "./vp-migrate-renovate.ts";

const scriptPath = path.resolve(import.meta.dirname, "vp-migrate-renovate.ts");

const workspace16 = `catalog:
  vite: npm:@voidzero-dev/vite-plus-core@1.6.0
  vite-plus: 1.6.0
  vitest: 5.1.0
  "@vitest/browser-playwright": 5.1.0
overrides:
  vite@*: "catalog:"
  vitest@*: "catalog:"
peerDependencyRules:
  allowAny:
    - vite
    - vitest
  allowedVersions:
    vite: "*"
    stylelint: "18"
`;

const originalPackage = `{
  "devDependencies": {
    "vite": "catalog:",
    "vite-plus": "catalog:",
    "vitest": "catalog:",
    "@vitest/browser-playwright": "catalog:",
    "vitest-browser-react": "2.3.0"
  }
}
`;

function gitEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.com",
  };
}

function git(cwd: string, args: readonly string[]): void {
  execFileSync("git", args, { cwd, env: gitEnv(), stdio: "pipe" });
}

function readLog(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function writeExecutable(file: string, body: string): void {
  writeFileSync(file, body);
  chmodSync(file, 0o755);
}

function runScript(
  cwd: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): ReturnType<typeof spawnSync> {
  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", scriptPath, ...args],
    {
      cwd,
      encoding: "utf8",
      env: {
        ...gitEnv(),
        ...env,
        NODE_NO_WARNINGS: "1",
      },
    },
  );
}

describe("readCatalogVersion", () => {
  it("引用とコメントを外して semver を読む", () => {
    const text = "catalog:\n  'vite-plus': 1.6.0  # pin\n";
    expect(readCatalogVersion(text, "vite-plus")).toBe("1.6.0");
    expect(commitSubject("1.6.0")).toBe("chore: vp migrate 1.6.0");
  });

  it("semver でなければ失敗する", () => {
    expect(() =>
      readCatalogVersion("vite-plus: latest\n", "vite-plus"),
    ).toThrow(/不正/);
  });

  it("鍵が無ければ失敗する", () => {
    expect(() => readCatalogVersion("catalog:\n", "vite-plus")).toThrow(
      /見つかりません/,
    );
  });
});

describe("isAlreadyMigrated", () => {
  it("題名が chore: vp migrate のときだけ適用済み", () => {
    expect(isAlreadyMigrated("chore: vp migrate 1.6.0\n", "1.6.0")).toBe(true);
    expect(isAlreadyMigrated("Update vite-plus", "1.6.0")).toBe(false);
    expect(isAlreadyMigrated("chore: vp migrate 1.5.0", "1.6.0")).toBe(false);
  });
});

describe("gate", () => {
  it("HEAD の題名を git log で読み、未適用なら skip=false", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vp-gate-"));
    const bin = path.join(root, "bin");
    const gitLog = path.join(root, "git.log");
    const output = path.join(root, "github-output.txt");
    mkdirSync(bin);
    writeFileSync(path.join(root, "pnpm-workspace.yaml"), workspace16);
    writeExecutable(
      path.join(bin, "git"),
      `#!/bin/bash
set -euo pipefail
printf '%s\\n' "$*" >> "\${GIT_LOG:?}"
if [[ "\${1:-}" == "log" && "\${2:-}" == "-1" && "\${3:-}" == "--format=%s" ]]; then
  printf '%s\\n' "Update dependency vite-plus"
  exit 0
fi
printf 'unexpected git %s\\n' "$*" >&2
exit 1
`,
    );
    try {
      const result = runScript(root, ["gate"], {
        PATH: bin,
        GIT_LOG: gitLog,
        GITHUB_OUTPUT: output,
      });
      expect(result.status).toBe(0);
      expect(readLog(gitLog)).toBe("log -1 --format=%s\n");
      expect(readLog(output)).toBe("version=1.6.0\nskip=false\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("題名が migrate なら skip=true", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vp-gate-"));
    const bin = path.join(root, "bin");
    const output = path.join(root, "github-output.txt");
    mkdirSync(bin);
    writeFileSync(path.join(root, "pnpm-workspace.yaml"), workspace16);
    writeExecutable(
      path.join(bin, "git"),
      `#!/bin/bash
set -euo pipefail
printf '%s\\n' "chore: vp migrate 1.6.0"
`,
    );
    try {
      const result = runScript(root, ["gate"], {
        PATH: bin,
        GITHUB_OUTPUT: output,
      });
      expect(result.status).toBe(0);
      expect(readLog(output)).toBe("version=1.6.0\nskip=true\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("commit", () => {
  it("差分があれば対象ブランチだけへ push する", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vp-commit-"));
    const bin = path.join(root, "bin");
    const gitLog = path.join(root, "git.log");
    const output = path.join(root, "github-output.txt");
    mkdirSync(bin);
    writeFileSync(path.join(root, "pnpm-workspace.yaml"), workspace16);
    writeExecutable(
      path.join(bin, "git"),
      `#!/bin/bash
set -euo pipefail
printf '%s\\n' "$*" >> "\${GIT_LOG:?}"
if [[ "\${1:-}" == "status" ]]; then
  printf '%s\\n' " M pnpm-workspace.yaml"
  exit 0
fi
if [[ "\${1:-}" == "add" || "\${1:-}" == "-c" || "\${1:-}" == "push" ]]; then
  exit 0
fi
printf 'unexpected git %s\\n' "$*" >&2
exit 1
`,
    );
    try {
      const result = runScript(root, ["commit"], {
        PATH: bin,
        GIT_LOG: gitLog,
        GITHUB_OUTPUT: output,
        HEAD_REF: "renovate/vite-plus",
      });
      expect(result.status).toBe(0);
      const log = readLog(gitLog);
      expect(log).toContain("status --porcelain\n");
      expect(log).toContain("add -A\n");
      expect(log).toContain(
        "-c user.name=github-actions[bot] -c user.email=41898282+github-actions[bot]@users.noreply.github.com commit -m chore: vp migrate 1.6.0\n",
      );
      expect(log).toContain("push origin HEAD:renovate/vite-plus\n");
      expect(readLog(output)).toBe("pushed=true\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("差分が無ければ push しない", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vp-commit-"));
    const bin = path.join(root, "bin");
    const gitLog = path.join(root, "git.log");
    const output = path.join(root, "github-output.txt");
    mkdirSync(bin);
    writeExecutable(
      path.join(bin, "git"),
      `#!/bin/bash
set -euo pipefail
printf '%s\\n' "$*" >> "\${GIT_LOG:?}"
if [[ "\${1:-}" == "status" ]]; then
  exit 0
fi
exit 1
`,
    );
    try {
      const result = runScript(root, ["commit"], {
        PATH: bin,
        GIT_LOG: gitLog,
        GITHUB_OUTPUT: output,
        HEAD_REF: "renovate/vite-plus",
      });
      expect(result.status).toBe(0);
      expect(readLog(gitLog)).toBe("status --porcelain\n");
      expect(readLog(output)).toBe("pushed=false\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("対象外のブランチでは git を呼ばない", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vp-commit-"));
    const bin = path.join(root, "bin");
    const gitLog = path.join(root, "git.log");
    mkdirSync(bin);
    writeExecutable(
      path.join(bin, "git"),
      `#!/bin/bash
printf '%s\\n' "$*" >> "\${GIT_LOG:?}"
exit 1
`,
    );
    try {
      const result = runScript(root, ["commit"], {
        PATH: bin,
        GIT_LOG: gitLog,
        HEAD_REF: "other",
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("対象外のブランチです");
      expect(readLog(gitLog)).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("dispatch-tests", () => {
  it("ci.yml を renovate/vite-plus で起動する", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vp-dispatch-"));
    const bin = path.join(root, "bin");
    const ghLog = path.join(root, "gh.log");
    mkdirSync(bin);
    writeExecutable(
      path.join(bin, "gh"),
      `#!/bin/bash
printf '%s\\n' "$*" >> "\${GH_LOG:?}"
`,
    );
    try {
      const result = runScript(root, ["dispatch-tests"], {
        PATH: bin,
        GH_LOG: ghLog,
        HEAD_REF: "renovate/vite-plus",
        GH_TOKEN: "fake",
      });
      expect(result.status).toBe(0);
      expect(readLog(ghLog)).toBe(
        "workflow run ci.yml --ref renovate/vite-plus\n",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("対象外のブランチでは gh を呼ばない", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vp-dispatch-"));
    const bin = path.join(root, "bin");
    const ghLog = path.join(root, "gh.log");
    mkdirSync(bin);
    writeExecutable(
      path.join(bin, "gh"),
      `#!/bin/bash
printf '%s\\n' "$*" >> "\${GH_LOG:?}"
exit 1
`,
    );
    try {
      const result = runScript(root, ["dispatch-tests"], {
        PATH: bin,
        GH_LOG: ghLog,
        HEAD_REF: "main",
      });
      expect(result.status).toBe(1);
      expect(readLog(ghLog)).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("apply", () => {
  it("偽の vp で migrate し、生成物とピンを戻す", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vp-apply-"));
    const bin = path.join(root, "bin");
    const vpLog = path.join(root, "vp.log");
    mkdirSync(bin);
    writeFileSync(path.join(root, "pnpm-workspace.yaml"), workspace16);
    writeFileSync(path.join(root, "package.json"), originalPackage);
    writeFileSync(path.join(root, "AGENTS.md"), "keep\n");
    git(root, ["init", "-b", "main"]);
    git(root, ["add", "-A"]);
    git(root, ["commit", "-m", "Update dependency vite-plus"]);
    writeExecutable(
      path.join(bin, "vp"),
      `#!/bin/bash
set -euo pipefail
printf '%s\\n' "$*" >> "\${VP_LOG:?}"
if [[ "\${1:-}" == "migrate" && "\${2:-}" == "--no-interactive" ]]; then
  mkdir -p .vscode
  printf '%s\\n' generated > AGENTS.md
  printf '%s\\n' new > .vscode/settings.json
  cat > pnpm-workspace.yaml << 'EOF'
catalog:
  vite: npm:@voidzero-dev/vite-plus-core@1.6.0
  vite-plus: 1.6.0
  vitest: 5.1.0
  "@vitest/browser-playwright": 5.1.0
  oxlint: 2.0.0
overrides:
  vite: npm:@voidzero-dev/vite-plus-core@1.6.0
  vitest: 5.2.0
peerDependencyRules:
  allowAny:
    - vite
    - migrate-added
EOF
  cat > package.json << 'EOF'
{
  "devDependencies": {
    "vite": "1.6.0",
    "vite-plus": "1.6.0",
    "vitest": "5.2.0",
    "@vitest/browser-playwright": "5.2.0",
    "vitest-browser-react": "9.0.0"
  },
  "packageManager": "pnpm@12.18.0"
}
EOF
  exit 0
fi
if [[ "\${1:-}" == "toolchain" ]]; then
  printf '%s\\n' '{"source":{"scope":"global","vitePlusVersion":"1.6.0"},"nodes":[{"name":"vite-plus","version":"1.6.0"},{"name":"vitest","version":"5.2.0"}]}'
  exit 0
fi
if [[ "\${1:-}" == "install" ]]; then
  exit 0
fi
printf 'unexpected vp %s\\n' "$*" >&2
exit 1
`,
    );
    try {
      const result = runScript(root, ["apply"], {
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        VP_LOG: vpLog,
      });
      expect(result.status).toBe(0);
      expect(readLog(vpLog)).toBe(
        "migrate --no-interactive\ntoolchain vitest --global --json\ninstall\n",
      );
      expect(readFileSync(path.join(root, "AGENTS.md"), "utf8")).toBe("keep\n");
      expect(existsSync(path.join(root, ".vscode/settings.json"))).toBe(false);
      expect(readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8"))
        .toBe(`catalog:
  vite: npm:@voidzero-dev/vite-plus-core@1.6.0
  vite-plus: 1.6.0
  vitest: 5.2.0
  "@vitest/browser-playwright": 5.2.0
  oxlint: 2.0.0
overrides:
  vite@*: "catalog:"
  vitest@*: "catalog:"
peerDependencyRules:
  allowAny:
    - vite
    - vitest
  allowedVersions:
    vite: "*"
    stylelint: "18"
`);
      const restored: unknown = JSON.parse(
        readFileSync(path.join(root, "package.json"), "utf8"),
      );
      expect(restored).toMatchObject({
        devDependencies: {
          vite: "catalog:",
          "vite-plus": "catalog:",
          vitest: "catalog:",
          "@vitest/browser-playwright": "catalog:",
          "vitest-browser-react": "2.3.0",
        },
      });
      expect(restored).not.toHaveProperty("packageManager");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("すでに migrate 済みなら vp を呼ばない", () => {
    const root = mkdtempSync(path.join(tmpdir(), "vp-apply-"));
    const bin = path.join(root, "bin");
    const vpLog = path.join(root, "vp.log");
    mkdirSync(bin);
    writeFileSync(path.join(root, "pnpm-workspace.yaml"), workspace16);
    git(root, ["init", "-b", "main"]);
    git(root, ["add", "-A"]);
    git(root, ["commit", "-m", "chore: vp migrate 1.6.0"]);
    writeExecutable(
      path.join(bin, "vp"),
      `#!/bin/bash
printf '%s\\n' "$*" >> "\${VP_LOG:?}"
exit 1
`,
    );
    try {
      const result = runScript(root, ["apply"], {
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        VP_LOG: vpLog,
      });
      expect(result.status).toBe(0);
      expect(readLog(vpLog)).toBe("");
      expect(result.stdout).toContain("すでに chore: vp migrate 1.6.0");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
