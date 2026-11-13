// Renovate の renovate/vite-plus 上で、対象版のグローバル vp から公式の migrate を実行する。
// 実行前に PATH の vp をその版にしておく。コミットと push は commit が行う。
import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import {
  accessSync,
  appendFileSync,
  copyFileSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  parseToolchainJson,
  readBundledVitestVersion,
  restorePackageJsonText,
  restoreWorkspaceText,
  shouldRestorePath,
} from "./vp-migrate-pins.ts";

const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$/;

export const MIGRATE_BRANCH = "renovate/vite-plus";

const WORKSPACE_FILE = "pnpm-workspace.yaml";
const PACKAGE_FILE = "package.json";

type CommandResult = {
  status: number;
  stdout: string;
  stderr: string;
};

export function readCatalogVersion(text: string, key: string): string {
  const escaped = key.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^\\s*(?:${escaped}|"${escaped}"|'${escaped}')\\s*:\\s*(.*)$`,
  );
  for (const line of text.split("\n")) {
    const match = pattern.exec(line);
    if (match === null) {
      continue;
    }
    const raw = match[1] ?? "";
    const withoutComment = raw.split("#")[0] ?? "";
    const value = withoutComment.trim().replaceAll(/["']/g, "");
    if (!SEMVER.test(value)) {
      throw new Error(`${key} の版が不正です: ${value}`);
    }
    return value;
  }
  throw new Error(`catalog の ${key} が見つかりません。`);
}

export function commitSubject(version: string): string {
  if (!SEMVER.test(version)) {
    throw new Error(`vite-plus の版が不正です: ${version}`);
  }
  return `chore: vp migrate ${version}`;
}

export function isAlreadyMigrated(
  headSubject: string,
  version: string,
): boolean {
  return headSubject.trim() === commitSubject(version);
}

function appendGithubOutput(name: string, value: string): void {
  if (name.length === 0 || /[\r\n]/.test(name) || /[\r\n]/.test(value)) {
    throw new Error("GITHUB_OUTPUT に書けない値です");
  }
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath === undefined || outputPath.length === 0) {
    throw new Error("GITHUB_OUTPUT がありません");
  }
  appendFileSync(outputPath, `${name}=${value}\n`);
}

function run(file: string, args: readonly string[]): CommandResult {
  const result = spawnSync(file, args, { encoding: "utf8" });
  if (result.error) {
    throw result.error;
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function runInherit(file: string, args: readonly string[]): number {
  const result = spawnSync(file, args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

function gitStdout(args: readonly string[]): string {
  const result = run("git", args);
  if (result.stderr.length > 0) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} が失敗しました。`);
  }
  return result.stdout;
}

function readWorkspaceVersion(): string {
  return readCatalogVersion(readFileSync(WORKSPACE_FILE, "utf8"), "vite-plus");
}

function readHeadSubject(): string {
  return gitStdout(["log", "-1", "--format=%s"]).trim();
}

function requireMigrateBranch(): void {
  const headRef = process.env.HEAD_REF ?? "";
  if (headRef !== MIGRATE_BRANCH) {
    throw new Error(`対象外のブランチです: ${headRef}`);
  }
}

function findOnPath(name: string): string {
  const entries = (process.env.PATH ?? "").split(path.delimiter);
  for (const dir of entries) {
    if (dir.length === 0) {
      continue;
    }
    const candidate = path.join(dir, name);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error(
    "vp が PATH にありません。対象版のグローバル CLI を先に入れてください。",
  );
}

function assertInsideRepo(filePath: string): string {
  const root = realpathSync(process.cwd());
  const resolved = path.resolve(root, filePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`リポジトリの外は戻せません: ${filePath}`);
  }
  return relative.replaceAll("\\", "/");
}

function listedPaths(args: readonly string[]): string[] {
  return gitStdout(args)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function restoreGeneratedPaths(): void {
  const changed = [
    ...listedPaths(["diff", "--name-only", "HEAD"]),
    ...listedPaths(["ls-files", "--others", "--exclude-standard"]),
  ];
  for (const filePath of changed) {
    if (!shouldRestorePath(filePath)) {
      continue;
    }
    const relative = assertInsideRepo(filePath);
    const exists = run("git", ["cat-file", "-e", `HEAD:${relative}`]);
    if (exists.status === 0) {
      gitStdout(["checkout", "--", relative]);
      continue;
    }
    rmSync(path.resolve(process.cwd(), relative), {
      recursive: true,
      force: true,
    });
  }
}

function gate(): number {
  const version = readWorkspaceVersion();
  const skip = isAlreadyMigrated(readHeadSubject(), version);
  appendGithubOutput("version", version);
  appendGithubOutput("skip", skip ? "true" : "false");
  return 0;
}

function apply(): number {
  const originalWorkspace = readFileSync(WORKSPACE_FILE, "utf8");
  const version = readCatalogVersion(originalWorkspace, "vite-plus");
  if (isAlreadyMigrated(readHeadSubject(), version)) {
    console.log(`すでに ${commitSubject(version)} を適用済みです。`);
    return 0;
  }
  const vp = findOnPath("vp");
  const scratch = mkdtempSync(path.join(tmpdir(), "vp-migrate-"));
  const originalPackage = path.join(scratch, "package.json");
  try {
    copyFileSync(PACKAGE_FILE, originalPackage);
    const migrated = runInherit(vp, ["migrate", "--no-interactive"]);
    if (migrated !== 0) {
      return migrated;
    }
    restoreGeneratedPaths();
    const toolchain = run(vp, ["toolchain", "vitest", "--global", "--json"]);
    if (toolchain.stderr.length > 0) {
      process.stderr.write(toolchain.stderr);
    }
    if (toolchain.status !== 0) {
      return toolchain.status;
    }
    const vitest = readBundledVitestVersion(
      parseToolchainJson(toolchain.stdout),
      version,
    );
    writeFileSync(
      WORKSPACE_FILE,
      restoreWorkspaceText(
        originalWorkspace,
        readFileSync(WORKSPACE_FILE, "utf8"),
        version,
        vitest,
      ),
    );
    writeFileSync(
      PACKAGE_FILE,
      restorePackageJsonText(
        readFileSync(originalPackage, "utf8"),
        readFileSync(PACKAGE_FILE, "utf8"),
      ),
    );
    return runInherit(vp, ["install"]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function commitAndPush(): number {
  requireMigrateBranch();
  const status = run("git", ["status", "--porcelain"]);
  if (status.stderr.length > 0) {
    process.stderr.write(status.stderr);
  }
  if (status.status !== 0) {
    return status.status;
  }
  if (status.stdout.trim().length === 0) {
    console.log("差分はありません");
    appendGithubOutput("pushed", "false");
    return 0;
  }
  const subject = commitSubject(readWorkspaceVersion());
  const added = run("git", ["add", "-A"]);
  if (added.stderr.length > 0) {
    process.stderr.write(added.stderr);
  }
  if (added.status !== 0) {
    return added.status;
  }
  const committed = run("git", [
    "-c",
    "user.name=github-actions[bot]",
    "-c",
    "user.email=41898282+github-actions[bot]@users.noreply.github.com",
    "commit",
    "-m",
    subject,
  ]);
  if (committed.stderr.length > 0) {
    process.stderr.write(committed.stderr);
  }
  if (committed.status !== 0) {
    return committed.status;
  }
  const pushed = run("git", ["push", "origin", `HEAD:${MIGRATE_BRANCH}`]);
  if (pushed.stderr.length > 0) {
    process.stderr.write(pushed.stderr);
  }
  if (pushed.status !== 0) {
    return pushed.status;
  }
  appendGithubOutput("pushed", "true");
  return 0;
}

function dispatchTests(): number {
  requireMigrateBranch();
  const result = run("gh", [
    "workflow",
    "run",
    "ci.yml",
    "--ref",
    MIGRATE_BRANCH,
  ]);
  if (result.stdout.length > 0) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr.length > 0) {
    process.stderr.write(result.stderr);
  }
  return result.status;
}

function main(argv: readonly string[]): number {
  const command = argv[0];
  if (command === "gate") {
    return gate();
  }
  if (command === "apply") {
    return apply();
  }
  if (command === "commit") {
    return commitAndPush();
  }
  if (command === "dispatch-tests") {
    return dispatchTests();
  }
  throw new Error(
    "使い方: vp-migrate-renovate.ts <gate|apply|commit|dispatch-tests>",
  );
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
