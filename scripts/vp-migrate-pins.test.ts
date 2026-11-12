import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  parseToolchainJson,
  readBundledVitestVersion,
  restorePackageJsonText,
  restoreWorkspaceText,
  shouldRestorePath,
} from "./vp-migrate-pins.ts";

const repoRoot = path.resolve(import.meta.dirname, "..");
const shellScript = path.join(repoRoot, "scripts/vp-migrate-renovate.sh");

const originalWorkspace = `catalog:
  vite: npm:@voidzero-dev/vite-plus-core@1.5.0
  vite-plus: 1.5.0
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
    # stylelint 18 に、peer が 17 までの CSS Modules 関連を載せる。
    stylelint: "18"
`;

const migratedWorkspace = `catalog:
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
`;

describe("restoreWorkspaceText", () => {
  it("今の pnpm-workspace.yaml を同じ版で戻すと原文のまま", () => {
    const text = readFileSync(
      path.join(repoRoot, "pnpm-workspace.yaml"),
      "utf8",
    );
    expect(restoreWorkspaceText(text, text, "1.5.0", "5.1.0")).toBe(text);
  });

  it("catalog と override を戻し、peerDependencyRules は元のまま残す", () => {
    const restored = restoreWorkspaceText(
      originalWorkspace,
      migratedWorkspace,
      "1.6.0",
      "5.2.0",
    );
    expect(restored).toBe(`catalog:
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
    # stylelint 18 に、peer が 17 までの CSS Modules 関連を載せる。
    stylelint: "18"
`);
  });
});

describe("restorePackageJsonText", () => {
  it("catalog: を保ち、runtime と vitest-browser-react の書き換えを戻す", () => {
    const original = {
      devDependencies: {
        vite: "catalog:",
        "vite-plus": "catalog:",
        vitest: "catalog:",
        "@vitest/browser-playwright": "catalog:",
        "vitest-browser-react": "2.3.0",
      },
      devEngines: {
        packageManager: {
          name: "pnpm",
          version: "12.18.0",
          onFail: "download",
        },
      },
    };
    const migrated = {
      devDependencies: {
        vite: "1.6.0",
        "vite-plus": "1.6.0",
        vitest: "5.2.0",
        "@vitest/browser-playwright": "5.2.0",
        "vitest-browser-react": "9.0.0",
      },
      packageManager: "pnpm@12.18.0",
      devEngines: {
        packageManager: {
          name: "pnpm",
          version: "12.18.0",
          onFail: "download",
        },
        runtime: { name: "node", version: "26.13.0" },
      },
      pnpm: { overrides: { vitest: "5.2.0" } },
    };
    const restored: unknown = JSON.parse(
      restorePackageJsonText(
        JSON.stringify(original),
        JSON.stringify(migrated),
      ),
    );
    expect(restored).toMatchObject({
      devDependencies: {
        vite: "catalog:",
        "vite-plus": "catalog:",
        vitest: "catalog:",
        "@vitest/browser-playwright": "catalog:",
        "vitest-browser-react": "2.3.0",
      },
      devEngines: {
        packageManager: { version: "12.18.0" },
      },
    });
    expect(restored).not.toHaveProperty("packageManager");
    expect(restored).not.toHaveProperty("pnpm");
    expect(restored).not.toHaveProperty("devEngines.runtime");
  });
});

describe("readBundledVitestVersion", () => {
  it("グローバル CLI の vitest を読む", () => {
    const parsed = parseToolchainJson(`log line
{"schemaVersion":1,"source":{"scope":"global","vitePlusVersion":"1.6.0"},"nodes":[{"id":"vite-plus","name":"vite-plus","version":"1.6.0"},{"id":"vitest","name":"vitest","version":"5.2.0"}]}
`);
    expect(readBundledVitestVersion(parsed, "1.6.0")).toBe("5.2.0");
  });

  it("ローカルの vite-plus を見ていたら止める", () => {
    const parsed = parseToolchainJson(
      '{"source":{"scope":"local","vitePlusVersion":"1.6.0"},"nodes":[{"name":"vitest","version":"5.2.0"}]}',
    );
    expect(() => readBundledVitestVersion(parsed, "1.6.0")).toThrow(
      /グローバル/,
    );
  });
});

describe("shouldRestorePath", () => {
  it("agent ファイルとエディタ、git hooks だけを戻す", () => {
    expect(shouldRestorePath("AGENTS.md")).toBe(true);
    expect(shouldRestorePath(".github/copilot-instructions.md")).toBe(true);
    expect(shouldRestorePath(".vscode/settings.json")).toBe(true);
    expect(shouldRestorePath(".husky/pre-commit")).toBe(true);
    expect(shouldRestorePath("lefthook.yml")).toBe(true);
    expect(shouldRestorePath("pnpm-workspace.yaml")).toBe(false);
    expect(shouldRestorePath("src/AGENTS.md")).toBe(false);
    expect(shouldRestorePath("../AGENTS.md")).toBe(false);
  });
});

describe("vp-migrate-renovate.sh", () => {
  it("catalog の vite-plus とコミット題名を返す", () => {
    const version = execFileSync("bash", [shellScript, "version"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    const subject = execFileSync("bash", [shellScript, "commit-subject"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    expect(version).toBe("1.5.0");
    expect(subject).toBe("chore: vp migrate 1.5.0");
  });

  it("まだ migrate コミットが無ければ already-applied は失敗する", () => {
    const result = spawnSync("bash", [shellScript, "already-applied"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
  });
});
