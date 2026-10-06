// 既存の要素が同じ順序で残り、新しい要素だけが増えているときに追加とみなす。
// 既存要素の修正、削除、並べ替えは追加ではない。途中への挿入は追加とみなす。
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const RECIPE_PATHS = [
  "src/mapping.json",
  "src/original-recipes.json",
] as const;

export const OPT_OUT_LABEL = "no-auto-merge";

function isRecipePath(
  filePath: string,
): filePath is (typeof RECIPE_PATHS)[number] {
  return (RECIPE_PATHS as readonly string[]).includes(filePath);
}

const TRUSTED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

export type NameStatus = {
  status: string;
  path: string;
};

type RecipePullRequest = {
  number: number;
  state: string;
  draft: boolean;
  authorAssociation: string;
  labels: readonly string[];
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string;
  headRepo: string | null;
  baseRepo: string | null;
};

export type PullRequestDecision =
  | { skip: true; reason: string }
  | {
      skip: false;
      reason: string;
      number: number;
      baseSha: string;
      headSha: string;
      headRef: string;
    };

export type DiffDecision = {
  ok: boolean;
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value).toSorted();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? '"undefined"';
}

export function jsonEqual(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

export function additionsOnly(base: unknown, head: unknown): DiffDecision {
  if (!Array.isArray(base) || !Array.isArray(head)) {
    return { ok: false, reason: "ルートが配列ではありません" };
  }

  let headIndex = 0;
  let added = 0;
  for (let baseIndex = 0; baseIndex < base.length; baseIndex += 1) {
    let found = false;
    while (headIndex < head.length) {
      if (jsonEqual(base[baseIndex], head[headIndex])) {
        found = true;
        headIndex += 1;
        break;
      }
      added += 1;
      headIndex += 1;
    }
    if (!found) {
      return {
        ok: false,
        reason: `既存の ${baseIndex + 1} 件目が残っていません`,
      };
    }
  }

  added += head.length - headIndex;
  if (added === 0) {
    return { ok: false, reason: "追加がありません" };
  }
  return { ok: true, reason: `${added} 件追加しています` };
}

export function parseNameStatus(output: string): NameStatus[] {
  const parts = output.split("\0").filter((part) => part.length > 0);
  const entries: NameStatus[] = [];
  for (let index = 0; index < parts.length;) {
    const status = parts[index];
    if (status === undefined) {
      throw new Error("git diff --name-status の出力を解釈できません");
    }
    if (status.startsWith("R") || status.startsWith("C")) {
      throw new Error(
        "名前変更やコピーを含む差分は解釈しません。--no-renames を付けてください",
      );
    }
    const filePath = parts[index + 1];
    if (filePath === undefined) {
      throw new Error("git diff --name-status の出力を解釈できません");
    }
    entries.push({ status, path: filePath });
    index += 2;
  }
  return entries;
}

function parseJson(
  text: string,
  filePath: string,
): DiffDecision | { value: unknown } {
  try {
    return { value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: `${filePath} が JSON ではありません` };
  }
}

export function classifyRecipeDiff(
  entries: readonly NameStatus[],
  readFile: (rev: string, filePath: string) => string,
  baseRev: string,
  headRev: string,
): DiffDecision {
  if (entries.length === 0) {
    return { ok: false, reason: "変更がありません" };
  }

  const allowed = new Set<string>(RECIPE_PATHS);
  for (const entry of entries) {
    if (!allowed.has(entry.path)) {
      return {
        ok: false,
        reason: `レシピ以外のファイルが変わっています: ${entry.path}`,
      };
    }
    if (entry.status !== "M") {
      return {
        ok: false,
        reason: `ファイルの新設や削除は対象外です: ${entry.status} ${entry.path}`,
      };
    }
  }

  const reasons: string[] = [];
  for (const entry of entries) {
    const baseParsed = parseJson(readFile(baseRev, entry.path), entry.path);
    if ("ok" in baseParsed) {
      return baseParsed;
    }
    const headParsed = parseJson(readFile(headRev, entry.path), entry.path);
    if ("ok" in headParsed) {
      return headParsed;
    }
    const decision = additionsOnly(baseParsed.value, headParsed.value);
    if (!decision.ok) {
      return { ok: false, reason: `${entry.path}: ${decision.reason}` };
    }
    reasons.push(`${entry.path} に${decision.reason}`);
  }

  return { ok: true, reason: reasons.join("。") };
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`PR の ${key} がありません`);
  }
  return value;
}

function requiredBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`PR の ${key} がありません`);
  }
  return value;
}

function requiredNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`PR の ${key} がありません`);
  }
  return value;
}

function repoFullName(repo: unknown): string | null {
  if (repo === null) {
    return null;
  }
  if (!isRecord(repo)) {
    throw new Error("PR のリポジトリが不正です");
  }
  return requiredString(repo, "full_name");
}

function labelNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("PR の labels が配列ではありません");
  }
  return value.map((label) => {
    if (!isRecord(label)) {
      throw new Error("PR の label が不正です");
    }
    return requiredString(label, "name");
  });
}

function parseRef(
  record: Record<string, unknown>,
  key: string,
): {
  ref: string;
  sha: string;
  repo: string | null;
} {
  const value = record[key];
  if (!isRecord(value)) {
    throw new Error(`PR の ${key} が不正です`);
  }
  return {
    ref: requiredString(value, "ref"),
    sha: requiredString(value, "sha"),
    repo: repoFullName(value.repo),
  };
}

function parsePullRequest(value: unknown): RecipePullRequest {
  if (!isRecord(value)) {
    throw new Error("PR がオブジェクトではありません");
  }
  const base = parseRef(value, "base");
  const head = parseRef(value, "head");
  return {
    number: requiredNumber(value, "number"),
    state: requiredString(value, "state"),
    draft: requiredBoolean(value, "draft"),
    authorAssociation: requiredString(value, "author_association"),
    labels: labelNames(value.labels),
    baseRef: base.ref,
    baseSha: base.sha,
    baseRepo: base.repo,
    headRef: head.ref,
    headSha: head.sha,
    headRepo: head.repo,
  };
}

function sameRepo(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function rejectionReason(pull: RecipePullRequest, repo: string): string | null {
  if (pull.state !== "open") {
    return "PR は開いていません";
  }
  if (pull.draft) {
    return "下書きのためマージしません。Ready for review にすると、このコミットの CI が成功していればマージします";
  }
  if (pull.baseRef !== "main") {
    return "ベースブランチが main ではありません";
  }
  if (
    pull.baseRepo === null ||
    pull.headRepo === null ||
    !sameRepo(pull.baseRepo, repo) ||
    !sameRepo(pull.headRepo, repo)
  ) {
    return "フォークからの PR はマージしません";
  }
  if (!TRUSTED_ASSOCIATIONS.has(pull.authorAssociation)) {
    return `作者の権限が対象外です: ${pull.authorAssociation}`;
  }
  if (pull.labels.includes(OPT_OUT_LABEL)) {
    return `${OPT_OUT_LABEL} ラベルがあるためマージしません`;
  }
  return null;
}

export function selectFromPayload(
  payload: unknown,
  headSha: string,
  repo: string,
): PullRequestDecision {
  if (!Array.isArray(payload)) {
    throw new Error("PR 一覧が配列ではありません");
  }

  const pulls = payload.map((item) => parsePullRequest(item));
  const matches = pulls.filter((pull) => pull.headSha === headSha);
  if (matches.length === 0) {
    return {
      skip: true,
      reason: "このコミットを先頭にする開いた PR がありません",
    };
  }
  if (matches.length > 1) {
    return { skip: true, reason: "このコミットを先頭にする PR が複数あります" };
  }

  const pull = matches[0];
  if (pull === undefined) {
    return {
      skip: true,
      reason: "このコミットを先頭にする開いた PR がありません",
    };
  }

  const reason = rejectionReason(pull, repo);
  if (reason !== null) {
    return { skip: true, reason };
  }

  return {
    skip: false,
    reason: `PR #${pull.number} はレシピ追加の自動マージ対象です`,
    number: pull.number,
    baseSha: pull.baseSha,
    headSha: pull.headSha,
    headRef: pull.headRef,
  };
}

function assertSha(sha: string, label: string): void {
  if (!/^[0-9a-fA-F]{40}$/.test(sha)) {
    throw new Error(`${label} がコミット SHA ではありません`);
  }
}

function gitOutput(args: readonly string[]): string {
  return execFileSync("git", args, { encoding: "utf8" });
}

export function readGitDiff(baseSha: string, headSha: string): DiffDecision {
  assertSha(baseSha, "base");
  assertSha(headSha, "head");
  const output = gitOutput([
    "diff",
    "--name-status",
    "--no-renames",
    "-z",
    baseSha,
    headSha,
  ]);
  const entries = parseNameStatus(output);
  return classifyRecipeDiff(
    entries,
    (rev, filePath) => {
      if (!isRecipePath(filePath)) {
        throw new Error(`許可していないパスです: ${filePath}`);
      }
      return gitOutput(["show", `${rev}:${filePath}`]);
    },
    baseSha,
    headSha,
  );
}

function printDecision(decision: PullRequestDecision): void {
  console.error(decision.reason);
  if (decision.skip) {
    console.log("skip=true");
    return;
  }
  console.log(`number=${decision.number}`);
  console.log(`base=${decision.baseSha}`);
  console.log(`head=${decision.headSha}`);
  console.log(`ref=${decision.headRef}`);
}

function runSelect(args: readonly string[]): void {
  const [filePath, headSha, repo] = args;
  if (filePath === undefined || headSha === undefined || repo === undefined) {
    throw new Error(
      "使い方: recipe-additions-only.ts select-pr <pulls.json> <head-sha> <owner/repo>",
    );
  }
  assertSha(headSha, "head");
  const payload: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  printDecision(selectFromPayload(payload, headSha, repo));
}

function runDiff(args: readonly string[]): void {
  const [baseSha, headSha] = args;
  if (baseSha === undefined || headSha === undefined) {
    throw new Error(
      "使い方: recipe-additions-only.ts diff <base-sha> <head-sha>",
    );
  }
  const decision = readGitDiff(baseSha, headSha);
  console.error(decision.reason);
  console.log(`ok=${decision.ok ? "true" : "false"}`);
}

function main(argv: readonly string[]): void {
  const [command, ...args] = argv;
  if (command === "select-pr") {
    runSelect(args);
    return;
  }
  if (command === "diff") {
    runDiff(args);
    return;
  }
  throw new Error("使い方: recipe-additions-only.ts <select-pr|diff> ...");
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
    main(process.argv.slice(2));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
