// CI が成功した「レシピ追加だけ」の PR を squash マージする。
// マージ後は main の CI を手動起動する。成功すると ci.yml の pages がデプロイする。
// マージコマンドが失敗しても、PR がマージ済みなら起動まで進む。
// このスクリプトは既定ブランチのものを使う。PR ブランチのコードは実行しない。
// カレントディレクトリは、ベース側を checkout した git リポジトリであること。
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { readGitDiff, selectFromPayload } from "./recipe-additions-only.ts";

const COMMIT_SHA = /^[0-9a-fA-F]{40}$/;
const REPO_SLUG = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const BRANCH_NAME = /^[A-Za-z0-9._/-]+$/;

export function isCommitSha(value: string): boolean {
  return COMMIT_SHA.test(value);
}

export function isRepoSlug(value: string): boolean {
  return REPO_SLUG.test(value);
}

export function isSafeBranchName(value: string): boolean {
  return (
    BRANCH_NAME.test(value) &&
    !value.includes("..") &&
    !value.startsWith("/") &&
    !value.startsWith("-")
  );
}

type CommandResult = {
  status: number;
  stdout: string;
};

function run(command: string, args: readonly string[]): CommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: process.env,
  });
  if (result.error) {
    throw result.error;
  }
  const stderr = result.stderr ?? "";
  if (stderr.length > 0) {
    process.stderr.write(stderr);
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
  };
}

function commitExists(sha: string): boolean {
  const result = spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
    stdio: "ignore",
  });
  if (result.error) {
    throw result.error;
  }
  return result.status === 0;
}

function finishMerge(number: number, repo: string, headSha: string): number {
  console.log(`レシピの追加だけなので、PR #${number} をマージします。`);
  const merge = run("gh", [
    "pr",
    "merge",
    String(number),
    "--repo",
    repo,
    "--squash",
    "--match-head-commit",
    headSha,
  ]);
  if (merge.status !== 0) {
    const view = run("gh", [
      "pr",
      "view",
      String(number),
      "--repo",
      repo,
      "--json",
      "state",
      "--jq",
      ".state",
    ]);
    if (view.status !== 0) {
      return view.status;
    }
    if (view.stdout.trim() !== "MERGED") {
      console.error(`PR #${number} をマージできませんでした。`);
      return merge.status;
    }
    console.log(`PR #${number} はマージ済みです。main の CI を起動します。`);
  }
  console.log("main の CI を起動してデプロイします。");
  return run("gh", [
    "workflow",
    "run",
    "ci.yml",
    "--repo",
    repo,
    "--ref",
    "main",
  ]).status;
}

export function runMerge(input: { headSha: string; repo: string }): number {
  if (input.headSha.length === 0) {
    throw new Error("HEAD_SHA が必要です");
  }
  if (input.repo.length === 0) {
    throw new Error("REPO が必要です");
  }
  if (!isCommitSha(input.headSha)) {
    throw new Error("HEAD_SHA がコミット SHA ではありません。");
  }
  if (!isRepoSlug(input.repo)) {
    throw new Error("REPO の形式が不正です。");
  }

  process.env.GIT_TERMINAL_PROMPT = "0";
  process.env.NODE_NO_WARNINGS = "1";

  const { headSha, repo } = input;
  const pulls = run("gh", ["api", `repos/${repo}/commits/${headSha}/pulls`]);
  if (pulls.status !== 0) {
    return pulls.status;
  }

  const payload: unknown = JSON.parse(pulls.stdout);
  const decision = selectFromPayload(payload, headSha, repo);
  console.error(decision.reason);
  if (decision.skip) {
    return 0;
  }
  if (!Number.isInteger(decision.number) || decision.number <= 0) {
    throw new Error("PR 番号が不正です。");
  }
  if (decision.headSha !== headSha) {
    throw new Error("判定した先頭コミットが HEAD_SHA と一致しません。");
  }
  if (!isCommitSha(decision.baseSha)) {
    throw new Error("ベース SHA が不正です。");
  }
  if (!isSafeBranchName(decision.headRef)) {
    throw new Error("ブランチ名が不正です。");
  }

  const fetchedMain = run("git", ["fetch", "--no-tags", "origin", "main"]);
  if (fetchedMain.status !== 0) {
    return fetchedMain.status;
  }
  if (!commitExists(decision.baseSha)) {
    throw new Error("ベースコミットを取得できませんでした。");
  }

  const fetchedBranch = run("git", [
    "fetch",
    "--no-tags",
    "origin",
    `refs/heads/${decision.headRef}`,
  ]);
  if (fetchedBranch.status !== 0) {
    return fetchedBranch.status;
  }
  const fetched = run("git", ["rev-parse", "FETCH_HEAD"]);
  if (fetched.status !== 0) {
    return fetched.status;
  }
  if (fetched.stdout.trim() !== headSha) {
    console.error(
      "ブランチの先頭が CI を走らせたコミットと違うため、マージしません。",
    );
    return 0;
  }

  const diff = readGitDiff(decision.baseSha, headSha);
  console.error(diff.reason);
  if (!diff.ok) {
    return 0;
  }
  return finishMerge(decision.number, repo, headSha);
}

function main(): number {
  return runMerge({
    headSha: process.env.HEAD_SHA ?? "",
    repo: process.env.REPO ?? "",
  });
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
    process.exit(main());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
