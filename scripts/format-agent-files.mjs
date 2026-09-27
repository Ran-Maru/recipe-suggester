// Runs `vp fmt` for agent edits and commits.
// Markdown-only changes are included. Oxfmt ignore rules (for example
// `.agents/**/*.md`) still apply, because fmt is invoked on repo paths.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { analyzeShellCommand } from "./format-commit-policy.mjs";

const FMT_FAILURE =
  "vp fmt に失敗したので、未整形のままコミットしません。出力を確認してから、もう一度 git commit してください。";

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function allow() {
  process.stdout.write('{"permission":"allow"}\n');
}

function deny(message) {
  process.stdout.write(
    `${JSON.stringify({ permission: "deny", agent_message: message, user_message: message })}\n`,
  );
}

function repoRoot(cwd) {
  const result = spawnSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function gitLines(repo, args) {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  if (result.status !== 0) return [];
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function resolveAlias(repo, name) {
  const result = spawnSync(
    "git",
    ["-C", repo, "config", "--get", `alias.${name}`],
    {
      encoding: "utf8",
    },
  );
  if (result.status !== 0) return null;
  const value = result.stdout.trim();
  return value || null;
}

function insideRepo(repo, abs) {
  const realRepo = fs.realpathSync(repo);
  let real = abs;
  try {
    real = fs.realpathSync(abs);
  } catch {
    const parent = path.dirname(abs);
    try {
      real = path.join(fs.realpathSync(parent), path.basename(abs));
    } catch {
      return false;
    }
  }
  return real === realRepo || real.startsWith(`${realRepo}${path.sep}`);
}

function toRepoPath(repo, shellCwd, raw) {
  if (!raw || raw === "." || raw === "./") return null;
  const abs = path.resolve(shellCwd, raw);
  if (!insideRepo(repo, abs)) return null;
  const rel = path.relative(repo, abs);
  return rel === "" ? null : rel.split(path.sep).join("/");
}

function listStaged(repo) {
  return gitLines(repo, [
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACMR",
  ]);
}

function listTrackedDirty(repo) {
  return gitLines(repo, ["diff", "--name-only", "--diff-filter=ACMR"]);
}

function listUntracked(repo) {
  return gitLines(repo, ["ls-files", "--others", "--exclude-standard"]);
}

function worktreeMatchesIndex(repo, rel) {
  const result = spawnSync("git", ["-C", repo, "diff", "--quiet", "--", rel], {
    encoding: "utf8",
  });
  return result.status === 0;
}

function isBinary(repo, rel) {
  const result = spawnSync(
    "git",
    ["-C", repo, "diff", "--cached", "--numstat", "--", rel],
    {
      encoding: "utf8",
    },
  );
  const line = result.stdout.split("\n").find(Boolean) ?? "";
  return line.startsWith("-\t-");
}

function runFmt(repo, files) {
  if (files.length === 0) return { ok: true, output: "" };
  const vp = path.join(repo, "node_modules", ".bin", "vp");
  if (!fs.existsSync(vp)) {
    return { ok: false, output: "node_modules/.bin/vp がありません。" };
  }
  const result = spawnSync(
    vp,
    ["fmt", "--no-error-on-unmatched-pattern", "--", ...files],
    { cwd: repo, encoding: "utf8" },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return { ok: result.status === 0, output };
}

function gitAdd(repo, files) {
  if (files.length === 0) return true;
  const result = spawnSync("git", ["-C", repo, "add", "--", ...files], {
    encoding: "utf8",
  });
  return result.status === 0;
}

function existingTargets(repo, rels) {
  return rels.filter((rel) => {
    if (/[*?[\]]/.test(rel)) return true;
    return fs.existsSync(path.join(repo, rel));
  });
}

/**
 * Format index contents of a partially staged text file, then restore and
 * format the worktree copy. Backup is restored in finally.
 */
function formatPartial(repo, rel) {
  const abs = path.join(repo, rel);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return true;
  if (isBinary(repo, rel)) return true;
  const shown = spawnSync("git", ["-C", repo, "show", `:${rel}`], {
    encoding: "utf8",
  });
  if (shown.status !== 0) return false;
  const backup = path.join(
    os.tmpdir(),
    `recipe-suggester-fmt-${process.pid}-${Math.random().toString(16).slice(2)}`,
  );
  fs.copyFileSync(abs, backup);
  try {
    fs.writeFileSync(abs, shown.stdout);
    const formatted = runFmt(repo, [rel]);
    if (!formatted.ok) return false;
    if (!gitAdd(repo, [rel])) return false;
  } finally {
    fs.copyFileSync(backup, abs);
    fs.rmSync(backup, { force: true });
  }
  return runFmt(repo, [rel]).ok;
}

function formatPaths(repo, rels, { restageFullyStaged = false } = {}) {
  const targets = existingTargets(repo, [...new Set(rels)]);
  if (targets.length === 0) return { ok: true, output: "" };
  const fullyStaged = restageFullyStaged
    ? targets.filter(
        (rel) =>
          listStaged(repo).includes(rel) && worktreeMatchesIndex(repo, rel),
      )
    : [];
  const partial = restageFullyStaged
    ? listStaged(repo).filter(
        (rel) => targets.includes(rel) && !fullyStaged.includes(rel),
      )
    : [];
  const formatted = runFmt(repo, targets);
  if (!formatted.ok) return formatted;
  if (fullyStaged.length > 0 && !gitAdd(repo, fullyStaged)) {
    return {
      ok: false,
      output: "整形したファイルをインデックスへ戻せませんでした。",
    };
  }
  for (const rel of partial) {
    if (!formatPartial(repo, rel)) {
      return {
        ok: false,
        output: `ステージの一部だけを整形できませんでした: ${rel}`,
      };
    }
  }
  return formatted;
}

function collectCommitTargets(repo, shellCwd, analysis) {
  /** @type {string[]} */
  const rels = [...listStaged(repo)];
  if (analysis.includeTrackedDirty) rels.push(...listTrackedDirty(repo));
  if (analysis.includeUntracked) rels.push(...listUntracked(repo));
  for (const raw of analysis.explicitPaths) {
    if (raw === "." || raw === "./") {
      rels.push(...listTrackedDirty(repo), ...listUntracked(repo));
      continue;
    }
    const rel = toRepoPath(repo, shellCwd, raw);
    if (rel) rels.push(rel);
  }
  return rels;
}

function dirtyPaths(repo) {
  return [
    ...listStaged(repo),
    ...listTrackedDirty(repo),
    ...listUntracked(repo),
  ];
}

function makeReadFile(cwd) {
  return (file) => {
    if (typeof file !== "string" || file.length === 0 || file.includes("\0")) {
      return null;
    }
    try {
      const abs = path.resolve(cwd, file);
      const stat = fs.statSync(abs);
      if (!stat.isFile() || stat.size > 65536) return null;
      return fs.readFileSync(abs, "utf8");
    } catch {
      return null;
    }
  };
}

function beforeCommit() {
  const payload = JSON.parse(readStdin() || "{}");
  const command = typeof payload.command === "string" ? payload.command : "";
  const cwd =
    typeof payload.cwd === "string" && payload.cwd
      ? payload.cwd
      : process.cwd();
  const preliminary = repoRoot(cwd);
  const readFile = makeReadFile(cwd);
  let analysis = analyzeShellCommand(command, {
    resolveAlias: preliminary
      ? (name) => resolveAlias(preliminary, name)
      : () => null,
    readFile,
  });
  const pathCwd = analysis.commitCwd
    ? path.resolve(cwd, analysis.commitCwd)
    : cwd;
  const repo = analysis.commitCwd
    ? (repoRoot(pathCwd) ?? preliminary)
    : preliminary;
  if (analysis.commitCwd && repo && repo !== preliminary) {
    analysis = analyzeShellCommand(command, {
      resolveAlias: (name) => resolveAlias(repo, name),
      readFile,
    });
  }
  if (analysis.deny) {
    deny(analysis.message ?? MESSAGES_FALLBACK);
    return;
  }
  if (analysis.noVerifyAmend) {
    if (repo && listStaged(repo).length > 0) {
      deny(
        "ステージした変更がある状態で git commit --amend --no-verify はできません。フックを外すと vp fmt が走りません。",
      );
      return;
    }
    allow();
    return;
  }
  if (!analysis.formatBeforeCommit || !repo) {
    allow();
    return;
  }
  const result = formatPaths(
    repo,
    collectCommitTargets(repo, pathCwd, analysis),
    {
      restageFullyStaged: true,
    },
  );
  if (!result.ok) {
    deny(result.output ? `${FMT_FAILURE}\n${result.output}` : FMT_FAILURE);
    return;
  }
  allow();
}

const MESSAGES_FALLBACK =
  "コミットフックを外さないでください。Markdown だけの変更でも vp fmt が走る必要があります。";

function afterEdit() {
  const payload = JSON.parse(readStdin() || "{}");
  const filePath =
    typeof payload.file_path === "string"
      ? payload.file_path
      : typeof payload.path === "string"
        ? payload.path
        : "";
  if (!filePath) return;
  const cwd =
    typeof payload.cwd === "string" && payload.cwd
      ? payload.cwd
      : process.cwd();
  const repo = repoRoot(cwd) ?? repoRoot(path.dirname(filePath));
  if (!repo || !insideRepo(repo, filePath) || !fs.existsSync(filePath)) return;
  const rel = path
    .relative(repo, path.resolve(filePath))
    .split(path.sep)
    .join("/");
  // 編集直後はワークツリーだけ直す。インデックスは commit 前に合わせる。
  formatPaths(repo, [rel], { restageFullyStaged: false });
}

function afterShell() {
  const payload = JSON.parse(readStdin() || "{}");
  const cwd =
    typeof payload.cwd === "string" && payload.cwd
      ? payload.cwd
      : process.cwd();
  const repo = repoRoot(cwd);
  if (!repo) return;
  formatPaths(repo, dirtyPaths(repo), { restageFullyStaged: true });
}

function printAnalyze() {
  const aliasFlag = process.argv.indexOf("--aliases");
  const aliases =
    aliasFlag === -1 ? {} : JSON.parse(process.argv[aliasFlag + 1] ?? "{}");
  const filesFlag = process.argv.indexOf("--files");
  const files =
    filesFlag === -1 ? {} : JSON.parse(process.argv[filesFlag + 1] ?? "{}");
  const commandFlag = process.argv.indexOf("--");
  const command =
    commandFlag === -1 ? "" : process.argv.slice(commandFlag + 1).join(" ");
  const result = analyzeShellCommand(command, {
    resolveAlias: (name) => aliases[name] ?? null,
    readFile: (file) =>
      Object.prototype.hasOwnProperty.call(files, file) ? files[file] : null,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function main() {
  const mode = process.argv[2];
  if (mode === "--analyze") {
    printAnalyze();
    return;
  }
  if (mode === "before-commit") {
    beforeCommit();
    return;
  }
  if (mode === "after-edit") {
    afterEdit();
    return;
  }
  if (mode === "after-shell") {
    afterShell();
  }
}

const entry = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === entry) main();
