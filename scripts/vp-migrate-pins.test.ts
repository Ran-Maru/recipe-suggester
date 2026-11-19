import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { readCatalogVersion } from "./vp-migrate-renovate.ts";
import {
  parseToolchainJson,
  readBundledVitePlusCoreVersion,
  readBundledVitestVersion,
  restorePackageJsonText,
  restoreWorkspaceText,
  shouldRestorePath,
} from "./vp-migrate-pins.ts";

const repoRoot = path.resolve(import.meta.dirname, "..");

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
    const vitePlus = readCatalogVersion(text, "vite-plus");
    const viteCore =
      /npm:@voidzero-dev\/vite-plus-core@(\S+)/.exec(text)?.[1] ?? "";
    const vitest = readCatalogVersion(text, "vitest");
    expect(restoreWorkspaceText(text, text, vitePlus, viteCore, vitest)).toBe(
      text,
    );
  });

  it("catalog と override を戻し、peerDependencyRules は元のまま残す", () => {
    const restored = restoreWorkspaceText(
      originalWorkspace,
      migratedWorkspace,
      "1.6.0",
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

  it("vite-plus と core の版が違っても core の版を使う", () => {
    const migrated = `catalog:
  vite: npm:@voidzero-dev/vite-plus-core@8.3.8000
  vite-plus: 1.7.0
  vitest: 5.1.0
  "@vitest/browser-playwright": 5.1.0
overrides:
  vite: npm:@voidzero-dev/vite-plus-core@8.3.8000
  vitest: 5.1.0
peerDependencyRules:
  allowAny:
    - vitest
`;
    const restored = restoreWorkspaceText(
      originalWorkspace,
      migrated,
      "1.7.0",
      "8.3.8000",
      "5.1.0",
    );
    expect(restored).toContain(
      "vite: npm:@voidzero-dev/vite-plus-core@8.3.8000",
    );
    expect(restored).toContain("vite-plus: 1.7.0");
    expect(restored).not.toContain("vite-plus-core@1.7.0");
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
{"schemaVersion":1,"source":{"scope":"global","vitePlusVersion":"1.6.0"},"nodes":[{"id":"vite-plus","name":"vite-plus","version":"1.6.0"},{"id":"vite-plus-core","name":"@voidzero-dev/vite-plus-core","version":"8.3.8000"},{"id":"vitest","name":"vitest","version":"5.2.0"}]}
`);
    expect(readBundledVitestVersion(parsed, "1.6.0")).toBe("5.2.0");
    expect(readBundledVitePlusCoreVersion(parsed, "1.6.0")).toBe("8.3.8000");
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
