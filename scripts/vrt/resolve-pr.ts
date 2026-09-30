import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const SHA_PATTERN = /^[0-9a-f]{40}$/i;

export type PullRequestView = {
  state: string;
  url: string;
  baseRefOid: string;
  headRefOid: string;
  mergeCommitOid: string | null;
};

export type CheckoutPlan = {
  prNumber: number;
  prUrl: string;
  mode: "open" | "merged";
  beforeSha: string;
  headSha: string;
  mergeCommitSha: string;
};

export function decideShas(input: {
  eventName: string;
  prNumber: number;
  repository: string;
  pullRequestUrl?: string;
  baseSha?: string;
  headSha?: string;
  view?: PullRequestView;
}): CheckoutPlan {
  if (!Number.isInteger(input.prNumber) || input.prNumber <= 0) {
    throw new Error(`PR 番号が不正です: ${String(input.prNumber)}`);
  }
  if (input.eventName === "pull_request") {
    return {
      prNumber: input.prNumber,
      prUrl:
        input.pullRequestUrl ??
        `https://github.com/${input.repository}/pull/${String(input.prNumber)}`,
      mode: "open",
      beforeSha: assertSha(input.baseSha ?? "", "base"),
      headSha: assertSha(input.headSha ?? "", "head"),
      mergeCommitSha: "",
    };
  }
  if (input.eventName !== "workflow_dispatch") {
    throw new Error(`未対応のイベントです: ${input.eventName}`);
  }
  const view = input.view;
  if (!view) {
    throw new Error("手動実行では PR の情報が必要です");
  }
  if (view.state === "MERGED") {
    if (!view.mergeCommitOid) {
      throw new Error("マージコミットがありません");
    }
    return {
      prNumber: input.prNumber,
      prUrl: view.url,
      mode: "merged",
      beforeSha: "",
      headSha: "",
      mergeCommitSha: assertSha(view.mergeCommitOid, "merge commit"),
    };
  }
  return {
    prNumber: input.prNumber,
    prUrl: view.url,
    mode: "open",
    beforeSha: assertSha(view.baseRefOid, "base"),
    headSha: assertSha(view.headRefOid, "head"),
    mergeCommitSha: "",
  };
}

export function parsePullRequestView(json: string): PullRequestView {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("PR の情報を読めません");
  }
  const state = readString(parsed, "state");
  const url = readString(parsed, "url");
  const baseRefOid = readString(parsed, "baseRefOid");
  const headRefOid = readString(parsed, "headRefOid");
  const mergeCommit = Reflect.get(parsed, "mergeCommit");
  let mergeCommitOid: string | null = null;
  if (mergeCommit !== null && mergeCommit !== undefined) {
    if (typeof mergeCommit !== "object") {
      throw new Error("マージコミットの形式が不正です");
    }
    mergeCommitOid = readString(mergeCommit, "oid");
  }
  if (!state || !url || !baseRefOid || !headRefOid) {
    throw new Error("PR の情報に不足があります");
  }
  return { state, url, baseRefOid, headRefOid, mergeCommitOid };
}

function assertSha(value: string, label: string): string {
  if (!SHA_PATTERN.test(value)) {
    throw new Error(`${label} が SHA ではありません: ${value}`);
  }
  return value;
}

function readString(value: object, key: string): string {
  const found = Reflect.get(value, key);
  return typeof found === "string" ? found : "";
}

function outputLine(key: string, value: string): void {
  process.stdout.write(`${key}=${value}\n`);
}

function resolveFromEnv(): CheckoutPlan {
  const eventName = process.env.EVENT_NAME ?? "";
  const prNumber = Number(process.env.PR_NUMBER);
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const viewJson = process.env.PR_VIEW_JSON;
  return decideShas({
    eventName,
    prNumber,
    repository,
    pullRequestUrl: process.env.PR_URL,
    baseSha: process.env.BASE_SHA,
    headSha: process.env.HEAD_SHA,
    view: viewJson ? parsePullRequestView(viewJson) : undefined,
  });
}

function fetchView(prNumber: string): string {
  return execFileSync(
    "gh",
    [
      "pr",
      "view",
      prNumber,
      "--json",
      "state,url,baseRefOid,headRefOid,mergeCommit",
    ],
    { encoding: "utf8" },
  );
}

const isCli = process.argv[1]?.endsWith("resolve-pr.ts");
if (isCli) {
  if (
    process.env.EVENT_NAME === "workflow_dispatch" &&
    !process.env.PR_VIEW_JSON
  ) {
    const prNumber = process.env.PR_NUMBER ?? "";
    if (!/^[0-9]+$/.test(prNumber)) {
      throw new Error(`PR 番号が不正です: ${prNumber}`);
    }
    process.env.PR_VIEW_JSON = fetchView(prNumber);
  }
  const plan = resolveFromEnv();
  if (process.env.GITHUB_OUTPUT) {
    const lines = [
      `pr_number=${String(plan.prNumber)}`,
      `pr_url=${plan.prUrl}`,
      `mode=${plan.mode}`,
      `before_sha=${plan.beforeSha}`,
      `head_sha=${plan.headSha}`,
      `merge_commit_sha=${plan.mergeCommitSha}`,
      "",
    ];
    appendFileSync(process.env.GITHUB_OUTPUT, lines.join("\n"));
  } else {
    outputLine("pr_number", String(plan.prNumber));
    outputLine("pr_url", plan.prUrl);
    outputLine("mode", plan.mode);
    outputLine("before_sha", plan.beforeSha);
    outputLine("head_sha", plan.headSha);
    outputLine("merge_commit_sha", plan.mergeCommitSha);
  }
}
