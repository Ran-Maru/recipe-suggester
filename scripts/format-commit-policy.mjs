// Decides whether an agent shell command would skip `vp fmt` on commit.
// Pure: no git writes. Alias lookup is injected so tests do not need a repo.

const HOOK_OFF_VARS = ["VP_GIT_HOOKS", "HUSKY", "VITE_GIT_HOOKS"];

export const MESSAGES = {
  noVerify:
    "git commit に --no-verify や -n を付けないでください。外すと pre-commit の vp fmt が走らず、Markdown だけの変更が未整形のまま残ります。",
  hookEnv:
    "VP_GIT_HOOKS=0、HUSKY=0、VITE_GIT_HOOKS=0 は付けないでください。生成フックがここで終了し、Markdown だけの変更では vp fmt が走りません。",
  hooksPath:
    "core.hooksPath は変更しないでください。コミットフックが外れると vp fmt が走りません。",
};

const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh"]);
const GIT_BUILTINS = new Set([
  "add",
  "am",
  "apply",
  "archive",
  "bisect",
  "blame",
  "branch",
  "bundle",
  "checkout",
  "cherry-pick",
  "clean",
  "clone",
  "commit",
  "commit-tree",
  "config",
  "describe",
  "diff",
  "diff-tree",
  "fetch",
  "format-patch",
  "gc",
  "grep",
  "hash-object",
  "help",
  "init",
  "log",
  "ls-files",
  "merge",
  "merge-base",
  "mv",
  "notes",
  "pull",
  "push",
  "rebase",
  "reflog",
  "remote",
  "reset",
  "restore",
  "revert",
  "rev-parse",
  "rm",
  "shortlog",
  "show",
  "stash",
  "status",
  "submodule",
  "switch",
  "tag",
  "update-index",
  "version",
  "worktree",
]);
const INTERPRETERS = new Set(["python", "python3", "node", "perl", "ruby"]);

/**
 * @param {string} command
 * @param {{ resolveAlias?: (name: string) => string | null | undefined }} [options]
 */
export function analyzeShellCommand(command, options = {}) {
  const state = {
    deny: false,
    message: null,
    formatBeforeCommit: false,
    explicitPaths: [],
    includeTrackedDirty: false,
    includeUntracked: false,
    sawCommit: false,
    commitCwd: null,
    noVerifyAmend: false,
  };
  analyzeCommand(command, options, state, 0);
  if (
    !state.deny &&
    state.sawCommit &&
    (state.explicitPaths.length > 0 ||
      state.includeTrackedDirty ||
      state.includeUntracked)
  ) {
    state.formatBeforeCommit = true;
  }
  // A message-only `git commit --amend --no-verify` is allowed only when this
  // command itself does not also stage or commit file content. The runner
  // still rejects it when the index already has staged files.
  if (
    !state.deny &&
    state.noVerifyAmend &&
    (state.formatBeforeCommit ||
      state.explicitPaths.length > 0 ||
      state.includeTrackedDirty ||
      state.includeUntracked)
  ) {
    deny(state, MESSAGES.noVerify);
  }
  delete state.sawCommit;
  if (!state.formatBeforeCommit) state.commitCwd = null;
  if (state.deny) {
    state.formatBeforeCommit = false;
    state.explicitPaths = [];
    state.includeTrackedDirty = false;
    state.includeUntracked = false;
    state.commitCwd = null;
    state.noVerifyAmend = false;
  } else {
    state.explicitPaths = [...new Set(state.explicitPaths)];
  }
  return state;
}

/**
 * @param {string} command
 * @param {{ resolveAlias?: (name: string) => string | null | undefined }} options
 * @param {ReturnType<typeof analyzeShellCommand>} state
 * @param {number} depth
 */
function analyzeCommand(command, options, state, depth) {
  if (depth > 4 || state.deny) return;
  const tokens = tokenize(command);
  let segment = [];
  const flush = () => {
    if (segment.length > 0) {
      analyzeSegment(segment, options, state, depth);
      segment = [];
    }
  };
  for (const token of tokens) {
    if (token === "&&" || token === "||" || token === ";" || token === "|") {
      flush();
      continue;
    }
    segment.push(token);
  }
  flush();
}

/**
 * @param {string[]} tokens
 * @param {{ resolveAlias?: (name: string) => string | null | undefined }} options
 * @param {ReturnType<typeof analyzeShellCommand>} state
 * @param {number} depth
 */
function analyzeSegment(tokens, options, state, depth) {
  if (state.deny || tokens.length === 0) return;

  const exported = readExport(tokens);
  if (exported.kind === "export") {
    if (hookOffAssignment(exported.env)) deny(state, MESSAGES.hookEnv);
    else if (hooksPathViaGitConfigEnv(exported.env))
      deny(state, MESSAGES.hooksPath);
    return;
  }

  const unwrapped = unwrapLaunchers(tokens);
  if (hookOffAssignment(unwrapped.env)) {
    const git = findGit(unwrapped.tokens, options, 0);
    if (git?.subcommand === "commit" || git?.configs.some(disablesHooksPath)) {
      deny(state, MESSAGES.hookEnv);
      return;
    }
  }
  if (hooksPathViaGitConfigEnv(unwrapped.env)) {
    const git = findGit(unwrapped.tokens, options, 0);
    if (git?.subcommand === "commit") {
      deny(state, MESSAGES.hooksPath);
      return;
    }
  }

  const nested = nestedScript(unwrapped.tokens);
  if (nested) analyzeCommand(nested, options, state, depth + 1);
  else inspectScriptFiles(unwrapped.tokens, options, state, depth);

  const git = findGit(unwrapped.tokens, options, 0);
  if (!git) return;

  if (git.subcommand === "commit") {
    state.sawCommit = true;
    if (git.noVerify && git.messageOnlyAmend) state.noVerifyAmend = true;
    if (git.noVerify && !git.messageOnlyAmend) deny(state, MESSAGES.noVerify);
    if (git.hooksBypass === "env") deny(state, MESSAGES.hookEnv);
    if (git.hooksBypass === "path" || git.configs.some(disablesHooksPath)) {
      deny(state, MESSAGES.hooksPath);
    }
    if (git.gitCwd) state.commitCwd = git.gitCwd;
    if (!git.messageOnlyAmend) {
      state.formatBeforeCommit = true;
      state.explicitPaths.push(...git.paths);
      if (git.all) state.includeTrackedDirty = true;
    }
    return;
  }

  if (
    git.configs.some(configBypassesHooks) &&
    !GIT_BUILTINS.has(git.subcommand)
  ) {
    deny(state, MESSAGES.noVerify);
    return;
  }

  if (git.subcommand === "config" && mutatesHooksPath(git.configArgs)) {
    deny(state, MESSAGES.hooksPath);
    return;
  }
  if (git.subcommand === "config" && aliasConfigBypasses(git.configArgs)) {
    deny(state, MESSAGES.noVerify);
  }

  if (git.subcommand === "add") {
    state.explicitPaths.push(...git.paths);
    if (git.addAll) {
      if (git.paths.length === 0) {
        state.includeTrackedDirty = true;
        state.includeUntracked = true;
      }
    } else if (git.addUpdate && git.paths.length === 0) {
      state.includeTrackedDirty = true;
    }
    if (git.paths.some((p) => p === "." || p === "./")) {
      state.includeTrackedDirty = true;
      state.includeUntracked = true;
    }
  }
}

function deny(state, message) {
  state.deny = true;
  state.message = message;
}

function hookOffAssignment(env) {
  return HOOK_OFF_VARS.some((name) => env[name] === "0");
}

function bypassValue(value) {
  return (
    /\bcommit\b/.test(value) && /--no-verify|(?<![\w-])-n(?![\w-])/.test(value)
  );
}

function configBypassesHooks(entry) {
  const eq = entry.indexOf("=");
  if (eq === -1) return false;
  const key = entry.slice(0, eq).trim().toLowerCase();
  if (!key.startsWith("alias.")) return false;
  return bypassValue(entry.slice(eq + 1));
}

function aliasConfigBypasses(args) {
  const joined = args.join(" ");
  if (!/alias\./i.test(joined)) return false;
  return bypassValue(joined);
}

function disablesHooksPath(entry) {
  const raw = entry.trim();
  const eq = raw.indexOf("=");
  const key = (eq === -1 ? raw : raw.slice(0, eq)).trim().toLowerCase();
  return key === "core.hookspath";
}

function hooksPathViaGitConfigEnv(env) {
  const parameters = env.GIT_CONFIG_PARAMETERS;
  if (typeof parameters === "string" && /core\.hookspath/i.test(parameters)) {
    return true;
  }
  return Object.entries(env).some(([name, value]) => {
    if (!/^GIT_CONFIG_KEY_\d+$/.test(name)) return false;
    return String(value).trim().toLowerCase() === "core.hookspath";
  });
}

/**
 * Shell and interpreter scripts hide `git commit --no-verify` from the
 * command string. Read them when the caller provides `readFile`.
 * @param {string[]} tokens
 * @param {{ readFile?: (file: string) => string | null | undefined }} options
 * @param {ReturnType<typeof analyzeShellCommand>} state
 * @param {number} depth
 */
function inspectScriptFiles(tokens, options, state, depth) {
  if (state.deny || typeof options.readFile !== "function") return;
  if (!options.seenScripts) options.seenScripts = new Set();
  const head = baseName(tokens[0] ?? "");
  /** @type {{ file: string, kind: "shell" | "interpreter" }[]} */
  const files = [];
  if (SHELLS.has(head) || INTERPRETERS.has(head) || head === "source") {
    for (let i = 1; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (token.startsWith("-")) continue;
      files.push({
        file: token,
        kind: INTERPRETERS.has(head) ? "interpreter" : "shell",
      });
    }
  } else if (head === "." && tokens[1] && !tokens[1].startsWith("-")) {
    files.push({ file: tokens[1], kind: "shell" });
  } else if (tokens[0]) {
    const kind = directScriptKind(tokens[0]);
    if (kind) files.push({ file: tokens[0], kind });
  }
  for (const { file, kind } of files) {
    if (state.deny) return;
    if (options.seenScripts.has(file)) continue;
    options.seenScripts.add(file);
    let text;
    try {
      text = options.readFile(file);
    } catch {
      continue;
    }
    if (typeof text !== "string" || text.length === 0 || text.length > 65536) {
      continue;
    }
    if (kind === "interpreter") {
      if (
        /\bcommit\b/.test(text) &&
        /--no-verify|(?<![\w-])-n(?![\w-])/.test(text)
      ) {
        analyzeCommand("git commit --no-verify", options, state, depth + 1);
      }
      continue;
    }
    analyzeCommand(text, options, state, depth + 1);
  }
}

/**
 * @param {string} token
 * @returns {"shell" | "interpreter" | null}
 */
function directScriptKind(token) {
  if (/\.(py|js|mjs|cjs|rb|pl)$/.test(token)) return "interpreter";
  if (token.endsWith(".sh")) return "shell";
  return null;
}

/**
 * @param {string[]} tokens
 */
function readExport(tokens) {
  if (
    tokens[0] !== "export" &&
    tokens[0] !== "declare" &&
    tokens[0] !== "typeset"
  ) {
    return { kind: "none", env: {} };
  }
  let i = 1;
  if (tokens[0] !== "export") {
    let marked = false;
    while (i < tokens.length && tokens[i].startsWith("-")) {
      if (tokens[i].includes("x")) marked = true;
      i += 1;
    }
    if (!marked) return { kind: "none", env: {} };
  }
  const env = {};
  for (const token of tokens.slice(i)) {
    const eq = token.indexOf("=");
    if (eq === -1) continue;
    env[token.slice(0, eq)] = token.slice(eq + 1);
  }
  return { kind: "export", env };
}

/**
 * Drop env prefixes and wrappers (env, sudo, command, exec, nice, nohup, time).
 * @param {string[]} tokens
 */
function unwrapLaunchers(tokens) {
  const env = {};
  let rest = tokens.slice();
  for (let guard = 0; guard < 8 && rest.length > 0; guard += 1) {
    const head = baseName(rest[0]);
    if (isAssignment(rest[0])) {
      const eq = rest[0].indexOf("=");
      env[rest[0].slice(0, eq)] = rest[0].slice(eq + 1);
      rest = rest.slice(1);
      continue;
    }
    if (head === "env") {
      const parsed = parseEnvCommand(rest);
      Object.assign(env, parsed.env);
      rest = parsed.rest;
      continue;
    }
    if (head === "command") {
      rest = rest.slice(1);
      while (rest[0] === "-p" || rest[0] === "-v" || rest[0] === "--") {
        if (rest[0] === "--") {
          rest = rest.slice(1);
          break;
        }
        rest = rest.slice(1);
      }
      continue;
    }
    if (head === "exec" || head === "nohup") {
      rest = rest.slice(1);
      continue;
    }
    if (head === "time") {
      rest = rest.slice(1);
      if (rest[0] === "-p") rest = rest.slice(1);
      continue;
    }
    if (head === "nice") {
      rest = rest.slice(1);
      if (rest[0] === "-n" || rest[0] === "--adjustment") rest = rest.slice(2);
      else if (rest[0]?.startsWith("-n") && rest[0] !== "-n")
        rest = rest.slice(1);
      continue;
    }
    if (head === "sudo") {
      rest = rest.slice(1);
      while (rest.length > 0 && rest[0].startsWith("-")) {
        const flag = rest[0];
        rest = rest.slice(1);
        if (flag === "--") break;
        if (
          flag === "-u" ||
          flag === "-g" ||
          flag === "-C" ||
          flag === "-h" ||
          flag === "-p"
        ) {
          rest = rest.slice(1);
        }
      }
      continue;
    }
    break;
  }
  return { env, tokens: rest };
}

/**
 * @param {string[]} tokens token[0] === "env"
 */
function parseEnvCommand(tokens) {
  const env = {};
  let i = 1;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === "--") {
      i += 1;
      break;
    }
    if (
      token === "-i" ||
      token === "--ignore-environment" ||
      token === "-0" ||
      token === "-v"
    ) {
      i += 1;
      continue;
    }
    if (
      token === "-u" ||
      token === "--unset" ||
      token === "-C" ||
      token === "--chdir"
    ) {
      i += 2;
      continue;
    }
    if (token.startsWith("--unset=") || token.startsWith("--chdir=")) {
      i += 1;
      continue;
    }
    if (token.startsWith("-") && !isAssignment(token)) {
      i += 1;
      continue;
    }
    if (isAssignment(token)) {
      const eq = token.indexOf("=");
      env[token.slice(0, eq)] = token.slice(eq + 1);
      i += 1;
      continue;
    }
    break;
  }
  return { env, rest: tokens.slice(i) };
}

/**
 * @param {string[]} tokens
 */
function nestedScript(tokens) {
  if (tokens.length === 0) return null;
  const head = baseName(tokens[0]);
  if (SHELLS.has(head)) {
    for (let i = 1; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (token === "-c" || token === "--command") return tokens[i + 1] ?? null;
      // bash -lc 'script' bundles login (-l) with the command flag (-c).
      if (
        token.startsWith("-") &&
        !token.startsWith("--") &&
        token.endsWith("c")
      ) {
        return tokens[i + 1] ?? null;
      }
    }
  }
  if (head === "eval" && tokens[1]) return tokens.slice(1).join(" ");
  if (INTERPRETERS.has(head)) {
    const joined = tokens.join(" ");
    if (
      /\bcommit\b/.test(joined) &&
      /--no-verify|(?<![\w-])-n(?![\w-])/.test(joined)
    ) {
      return "git commit --no-verify";
    }
  }
  return null;
}

/**
 * @param {string[]} tokens
 * @param {{ resolveAlias?: (name: string) => string | null | undefined }} options
 * @param {number} depth
 */
function findGit(tokens, options, depth) {
  if (depth > 3 || tokens.length === 0) return null;
  if (baseName(tokens[0]) !== "git") return null;
  const parsed = parseGitArgs(tokens.slice(1));
  if (!parsed.subcommand) return null;
  if (GIT_BUILTINS.has(parsed.subcommand) || parsed.subcommand.includes("/"))
    return parsed;
  const alias = options.resolveAlias?.(parsed.subcommand);
  if (!alias) return parsed;
  if (alias.startsWith("!")) {
    const script = `${alias.slice(1)} ${parsed.rest.join(" ")}`.trim();
    const bypass = /--no-verify|(?<![\w-])-n(?![\w-])/.test(script);
    if (!/\bcommit\b/.test(script) && !bypass) return parsed;
    const hooksBypass = /(?:VP_GIT_HOOKS|HUSKY|VITE_GIT_HOOKS)=0/.test(script)
      ? "env"
      : /core\.hookspath/i.test(script)
        ? "path"
        : null;
    return {
      ...parsed,
      subcommand: "commit",
      noVerify: bypass,
      hooksBypass,
      paths: [],
      all: false,
      messageOnlyAmend: false,
    };
  }
  const extra = tokenize(alias).filter(
    (token) => !["&&", "||", ";", "|"].includes(token),
  );
  const expanded = findGit(
    ["git", ...extra, ...parsed.rest],
    options,
    depth + 1,
  );
  if (!expanded) return parsed;
  return { ...expanded, configs: [...parsed.configs, ...expanded.configs] };
}

/**
 * @param {string[]} args arguments after `git`, or after an alias expansion
 */
function parseGitArgs(args) {
  const configs = [];
  let gitCwd = null;
  let i = 0;
  while (i < args.length) {
    const token = args[i];
    if (token === "--") {
      i += 1;
      break;
    }
    if (token.startsWith("-c") && token !== "-c") {
      configs.push(token.slice(2));
      i += 1;
      continue;
    }
    if (token === "-c") {
      configs.push(args[i + 1] ?? "");
      i += 2;
      continue;
    }
    if (token === "-C") {
      gitCwd = args[i + 1] ?? null;
      i += 2;
      continue;
    }
    if (token.startsWith("-C") && token !== "-C") {
      gitCwd = token.slice(2);
      i += 1;
      continue;
    }
    if (
      token === "--git-dir" ||
      token === "--work-tree" ||
      token === "--namespace" ||
      token === "--exec-path" ||
      token === "--super-prefix"
    ) {
      i += 2;
      continue;
    }
    if (
      /^-(git-dir|work-tree|namespace|exec-path|super-prefix)=/.test(token) ||
      token.startsWith("--git-dir=") ||
      token.startsWith("--work-tree=") ||
      token.startsWith("--namespace=") ||
      token.startsWith("--exec-path=") ||
      token.startsWith("--super-prefix=")
    ) {
      i += 1;
      continue;
    }
    if (token.startsWith("-")) {
      i += 1;
      continue;
    }
    break;
  }

  const subcommand = args[i] ?? "";
  const rest = args.slice(i + 1);
  const base = {
    subcommand,
    configs,
    rest,
    noVerify: false,
    paths: [],
    all: false,
    messageOnlyAmend: false,
    hooksBypass: null,
    configArgs: rest,
    addAll: false,
    addUpdate: false,
    gitCwd,
  };
  if (subcommand === "commit")
    return { ...base, ...parseCommitArgs(rest), configs };
  if (subcommand === "add") return { ...base, ...parseAddArgs(rest), configs };
  return base;
}

const COMMIT_VALUE_SHORT = new Set(["m", "F", "c", "C", "t"]);
const COMMIT_VALUE_LONG = new Set([
  "--message",
  "--file",
  "--author",
  "--date",
  "--reuse-message",
  "--reedit-message",
  "--cleanup",
  "--pathspec-from-file",
  "--fixup",
  "--squash",
  "--trailer",
  "--template",
  "--gpg-sign",
]);

/**
 * @param {string[]} args
 */
function parseCommitArgs(args) {
  let noVerify = false;
  let all = false;
  let amend = false;
  let optionsEnded = false;
  /** @type {string[]} */
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (isRedirect(token)) continue;
    if (optionsEnded) {
      paths.push(token);
      continue;
    }
    if (token === "--") {
      optionsEnded = true;
      continue;
    }
    if (token === "--no-verify" || token.startsWith("--no-verify=")) {
      noVerify = true;
      continue;
    }
    if (token === "--all" || token === "-a") {
      all = true;
      continue;
    }
    if (token === "--amend") {
      amend = true;
      continue;
    }
    if (token.startsWith("--")) {
      if (!token.includes("=") && COMMIT_VALUE_LONG.has(token)) i += 1;
      continue;
    }
    if (token.startsWith("-") && token !== "-") {
      const cluster = token.slice(1);
      let consumed = false;
      for (let c = 0; c < cluster.length; c += 1) {
        const flag = cluster[c];
        if (flag === "n") noVerify = true;
        if (flag === "a") all = true;
        if (COMMIT_VALUE_SHORT.has(flag)) {
          const inline = cluster.slice(c + 1);
          if (inline.length === 0) i += 1;
          consumed = true;
          break;
        }
      }
      if (consumed) continue;
      continue;
    }
    paths.push(token);
  }
  return {
    noVerify,
    all,
    paths,
    messageOnlyAmend: amend && !all && paths.length === 0,
  };
}

/**
 * @param {string[]} args
 */
function parseAddArgs(args) {
  let addAll = false;
  let addUpdate = false;
  let optionsEnded = false;
  /** @type {string[]} */
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (isRedirect(token)) continue;
    if (optionsEnded) {
      paths.push(token);
      continue;
    }
    if (token === "--") {
      optionsEnded = true;
      continue;
    }
    if (
      token === "--all" ||
      token === "-A" ||
      token === "--no-ignore-removal"
    ) {
      addAll = true;
      continue;
    }
    if (token === "--update" || token === "-u") {
      addUpdate = true;
      continue;
    }
    if (token === "--pathspec-from-file" || token === "--chmod") {
      i += 1;
      continue;
    }
    if (token.startsWith("--")) continue;
    if (token.startsWith("-") && token !== "-") {
      if (token.includes("A")) addAll = true;
      if (token.includes("u")) addUpdate = true;
      continue;
    }
    paths.push(token);
  }
  return { paths, addAll, addUpdate };
}

/**
 * @param {string[]} args
 */
function mutatesHooksPath(args) {
  const keyAt = args.findIndex((arg) => arg.toLowerCase() === "core.hookspath");
  if (keyAt === -1) return false;
  const flags = args.filter((arg) => arg.startsWith("--"));
  const reads = flags.some(
    (flag) =>
      flag === "--get" ||
      flag === "--get-all" ||
      flag === "--get-regexp" ||
      flag.startsWith("--get=") ||
      flag === "--get-urlmatch" ||
      flag === "--list" ||
      flag === "--name-only",
  );
  const writes = flags.some(
    (flag) =>
      flag === "--unset" ||
      flag === "--unset-all" ||
      flag === "--replace-all" ||
      flag === "--add" ||
      flag === "--edit",
  );
  if (reads && !writes) return false;
  if (writes) return true;
  return keyAt < args.length - 1;
}

function isRedirect(token) {
  return (
    /^[0-9]*>>?/.test(token) ||
    /^[0-9]*<<?/.test(token) ||
    token === "&>" ||
    token.startsWith("&>")
  );
}

function isAssignment(token) {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

function baseName(token) {
  const slash = Math.max(token.lastIndexOf("/"), token.lastIndexOf("\\"));
  return slash === -1 ? token : token.slice(slash + 1);
}

/**
 * @param {string} command
 * @returns {string[]}
 */
export function tokenize(command) {
  /** @type {string[]} */
  const tokens = [];
  let cur = "";
  /** @type {"'" | "\"" | null} */
  let quote = null;
  const pushCur = () => {
    if (cur.length > 0) {
      tokens.push(cur);
      cur = "";
    }
  };
  for (let i = 0; i < command.length; i += 1) {
    const c = command[i];
    if (quote) {
      if (c === "\\" && quote === '"' && i + 1 < command.length) {
        cur += command[i + 1];
        i += 1;
        continue;
      }
      if (c === quote) {
        quote = null;
        continue;
      }
      cur += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      continue;
    }
    if (c === "\\" && i + 1 < command.length) {
      cur += command[i + 1];
      i += 1;
      continue;
    }
    if (c === "\n" || c === "\r") {
      pushCur();
      tokens.push(";");
      continue;
    }
    if (c === "&" && command[i + 1] === "&") {
      pushCur();
      tokens.push("&&");
      i += 1;
      continue;
    }
    if (c === "|" && command[i + 1] === "|") {
      pushCur();
      tokens.push("||");
      i += 1;
      continue;
    }
    if (c === "|") {
      pushCur();
      tokens.push("|");
      continue;
    }
    if (c === "&") {
      if (cur.endsWith(">")) {
        cur += "&";
        continue;
      }
      pushCur();
      tokens.push(";");
      continue;
    }
    if (c === ">" || c === "<") {
      cur += c;
      continue;
    }
    if (c === ";") {
      pushCur();
      tokens.push(";");
      continue;
    }
    if (/\s/.test(c)) {
      pushCur();
      continue;
    }
    cur += c;
  }
  pushCur();
  return tokens;
}
