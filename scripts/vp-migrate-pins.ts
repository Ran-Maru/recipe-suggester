import { readFileSync, writeFileSync } from "node:fs";

// vp migrate のあと、catalog と override をこのリポジトリの置き方に戻す。
// バージョンの正は引数。npm の最新や、migrate が書いた具体バージョンは使わない。

const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$/;

const CATALOG_SPECS = [
  {
    key: "vite",
    yamlKey: "vite",
    value: (versions: { vitePlus: string }) =>
      `npm:@voidzero-dev/vite-plus-core@${versions.vitePlus}`,
  },
  {
    key: "vite-plus",
    yamlKey: "vite-plus",
    value: (versions: { vitePlus: string }) => versions.vitePlus,
  },
  {
    key: "vitest",
    yamlKey: "vitest",
    value: (versions: { vitest: string }) => versions.vitest,
  },
  {
    key: "@vitest/browser-playwright",
    yamlKey: '"@vitest/browser-playwright"',
    value: (versions: { vitest: string }) => versions.vitest,
  },
] as const;

const RESTORE_EXACT = new Set([
  "AGENTS.md",
  ".github/copilot-instructions.md",
  "lefthook.yml",
  "lefthook.yaml",
  ".lefthook.yml",
]);

const RESTORE_PREFIXES = [
  ".vscode/",
  ".zed/",
  ".idea/",
  ".husky/",
  ".githooks/",
];

const CATALOG_DEPENDENCIES = [
  "vite",
  "vite-plus",
  "vitest",
  "@vitest/browser-playwright",
] as const;

type JsonObject = Record<string, unknown>;

type Section = {
  name: string;
  lines: string[];
};

type ToolchainNode = {
  id?: unknown;
  name?: unknown;
  version?: unknown;
};

function isSemver(value: string): boolean {
  return SEMVER.test(value);
}

export function shouldRestorePath(filePath: string): boolean {
  if (filePath.startsWith("/") || filePath.includes("..")) {
    return false;
  }
  const normalized = filePath.replaceAll("\\", "/");
  if (RESTORE_EXACT.has(normalized)) {
    return true;
  }
  return RESTORE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function parseToolchainJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end < start) {
    throw new Error("vp toolchain の JSON を読めません。");
  }
  const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
  return parsed;
}

export function readBundledVitestVersion(
  toolchainJson: unknown,
  expectedVitePlus: string,
): string {
  if (!isSemver(expectedVitePlus)) {
    throw new Error(`vite-plus の版が不正です: ${expectedVitePlus}`);
  }
  if (!isRecord(toolchainJson)) {
    throw new Error("vp toolchain の JSON ではありません。");
  }
  const source = toolchainJson.source;
  if (isRecord(source) && source.scope === "local") {
    throw new Error(
      "vp toolchain がプロジェクトの vite-plus を見ています。グローバル CLI の結果が必要です。",
    );
  }
  if (
    isRecord(source) &&
    typeof source.vitePlusVersion === "string" &&
    source.vitePlusVersion !== expectedVitePlus
  ) {
    throw new Error(
      `グローバル CLI は ${source.vitePlusVersion} です。対象は ${expectedVitePlus} です。`,
    );
  }
  if (!Array.isArray(toolchainJson.nodes)) {
    throw new Error("vp toolchain の nodes がありません。");
  }
  const nodes = toolchainJson.nodes.filter(isToolchainNode);
  const vitePlus = nodes.find(
    (node) => node.name === "vite-plus" || node.id === "vite-plus",
  );
  if (vitePlus && vitePlus.version !== expectedVitePlus) {
    throw new Error(
      `グローバル CLI は ${String(vitePlus.version)} です。対象は ${expectedVitePlus} です。`,
    );
  }
  const vitest = nodes.find(
    (node) => node.name === "vitest" || node.id === "vitest",
  );
  if (
    !vitest ||
    typeof vitest.version !== "string" ||
    !isSemver(vitest.version)
  ) {
    throw new Error("バンドルされている Vitest の版を読めません。");
  }
  return vitest.version;
}

export function restoreWorkspaceText(
  original: string,
  migrated: string,
  vitePlus: string,
  vitest: string,
): string {
  if (!isSemver(vitePlus)) {
    throw new Error(`vite-plus の版が不正です: ${vitePlus}`);
  }
  if (!isSemver(vitest)) {
    throw new Error(`Vitest の版が不正です: ${vitest}`);
  }
  const originalDoc = parseSections(original);
  const migratedDoc = parseSections(migrated);
  const peer = originalDoc.sections.find(
    (section) => section.name === "peerDependencyRules",
  );
  if (!peer) {
    throw new Error(
      "元の pnpm-workspace.yaml に peerDependencyRules がありません。",
    );
  }
  const catalog = migratedDoc.sections.find(
    (section) => section.name === "catalog",
  );
  if (!catalog) {
    throw new Error("pnpm-workspace.yaml に catalog がありません。");
  }
  catalog.lines = upsertCatalog(catalog.lines, vitePlus, vitest);
  const overrides = migratedDoc.sections.find(
    (section) => section.name === "overrides",
  );
  if (!overrides) {
    throw new Error("pnpm-workspace.yaml に overrides がありません。");
  }
  overrides.lines = replaceOverrides(overrides.lines);
  const peerIndex = migratedDoc.sections.findIndex(
    (section) => section.name === "peerDependencyRules",
  );
  const restoredPeer = { name: peer.name, lines: [...peer.lines] };
  if (peerIndex === -1) {
    migratedDoc.sections.push(restoredPeer);
  } else {
    migratedDoc.sections[peerIndex] = restoredPeer;
  }
  return renderSections(migratedDoc);
}

export function restorePackageJsonText(
  originalText: string,
  migratedText: string,
): string {
  const original = parseJsonObject(originalText, "元の package.json");
  const migrated = parseJsonObject(migratedText, "migrate 後の package.json");
  const dev = recordOrEmpty(migrated.devDependencies);
  const originalDev = recordOrEmpty(original.devDependencies);
  for (const name of CATALOG_DEPENDENCIES) {
    if (name in originalDev || name in dev) {
      dev[name] = "catalog:";
    }
  }
  if ("vitest-browser-react" in originalDev) {
    dev["vitest-browser-react"] = originalDev["vitest-browser-react"];
  } else {
    delete dev["vitest-browser-react"];
  }
  migrated.devDependencies = dev;
  if ("packageManager" in original) {
    migrated.packageManager = original.packageManager;
  } else {
    delete migrated.packageManager;
  }
  if ("devEngines" in original) {
    migrated.devEngines = original.devEngines;
  } else if (isRecord(migrated.devEngines)) {
    delete migrated.devEngines.runtime;
  }
  if (!("pnpm" in original)) {
    delete migrated.pnpm;
  }
  return `${JSON.stringify(migrated, null, 2)}\n`;
}

function parseSections(text: string): {
  leading: string[];
  sections: Section[];
} {
  const lines = splitLines(text);
  const leading: string[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of lines) {
    const match = /^([A-Za-z_][\w]*):/.exec(line);
    if (match && !line.startsWith(" ") && !line.startsWith("\t")) {
      current = { name: match[1], lines: [line] };
      sections.push(current);
      continue;
    }
    if (current === null) {
      leading.push(line);
    } else {
      current.lines.push(line);
    }
  }
  return { leading, sections };
}

function renderSections(doc: {
  leading: string[];
  sections: Section[];
}): string {
  const chunks: string[] = [];
  if (doc.leading.length > 0) {
    chunks.push(doc.leading.join("\n"));
  }
  for (const section of doc.sections) {
    chunks.push(section.lines.join("\n"));
  }
  return `${chunks.join("\n")}\n`;
}

function upsertCatalog(
  lines: string[],
  vitePlus: string,
  vitest: string,
): string[] {
  let next = [...lines];
  for (const spec of CATALOG_SPECS) {
    next = upsertKey(
      next,
      spec.key,
      spec.yamlKey,
      spec.value({ vitePlus, vitest }),
    );
  }
  return next;
}

function upsertKey(
  lines: string[],
  key: string,
  yamlKey: string,
  value: string,
): string[] {
  const pattern = keyPattern(key);
  let found = false;
  const next = lines.map((line, index) => {
    if (index === 0 || !pattern.test(line)) {
      return line;
    }
    found = true;
    const indent = /^(\s+)/.exec(line)?.[1] ?? "  ";
    return `${indent}${yamlKey}: ${value}`;
  });
  if (found) {
    return next;
  }
  let insertAt = next.length;
  while (insertAt > 1 && next[insertAt - 1].trim() === "") {
    insertAt -= 1;
  }
  next.splice(insertAt, 0, `  ${yamlKey}: ${value}`);
  return next;
}

function replaceOverrides(lines: string[]): string[] {
  const trailing: string[] = [];
  const body = lines.slice(1);
  while (body.length > 0 && body[body.length - 1].trim() === "") {
    trailing.unshift(body.pop() ?? "");
  }
  return [
    lines[0] ?? "overrides:",
    '  vite@*: "catalog:"',
    '  vitest@*: "catalog:"',
    ...trailing,
  ];
}

function keyPattern(key: string): RegExp {
  const escaped = key.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s+(?:${escaped}|"${escaped}"|'${escaped}')\\s*:`);
}

function splitLines(text: string): string[] {
  const lines = text.split("\n");
  if (text.endsWith("\n")) {
    lines.pop();
  }
  return lines;
}

function parseJsonObject(text: string, label: string): JsonObject {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) {
    throw new Error(`${label} がオブジェクトではありません。`);
  }
  return parsed;
}

function recordOrEmpty(value: unknown): JsonObject {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    throw new Error("devDependencies がオブジェクトではありません。");
  }
  return value;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isToolchainNode(value: unknown): value is ToolchainNode {
  return isRecord(value);
}

function main(): void {
  const [command, ...args] = process.argv.slice(2);
  if (command === "filter-restore-paths") {
    const input = readStdin();
    for (const filePath of input.split("\n")) {
      const trimmed = filePath.trim();
      if (trimmed && shouldRestorePath(trimmed)) {
        process.stdout.write(`${trimmed}\n`);
      }
    }
    return;
  }
  if (command === "apply-pins") {
    const [origWs, origPkg, wsPath, pkgPath, vitePlus, toolchainPath] = args;
    if (
      !origWs ||
      !origPkg ||
      !wsPath ||
      !pkgPath ||
      !vitePlus ||
      !toolchainPath
    ) {
      throw new Error(
        "usage: apply-pins <orig-workspace> <orig-package> <workspace> <package> <vite-plus> <toolchain-json>",
      );
    }
    const toolchain = parseToolchainJson(readFile(toolchainPath));
    const vitest = readBundledVitestVersion(toolchain, vitePlus);
    const workspace = restoreWorkspaceText(
      readFile(origWs),
      readFile(wsPath),
      vitePlus,
      vitest,
    );
    const pkg = restorePackageJsonText(readFile(origPkg), readFile(pkgPath));
    writeFile(wsPath, workspace);
    writeFile(pkgPath, pkg);
    return;
  }
  throw new Error(`不明なコマンドです: ${command ?? ""}`);
}

function readStdin(): string {
  return readFileSync(0, "utf8");
}

function readFile(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function writeFile(filePath: string, text: string): void {
  writeFileSync(filePath, text);
}

if (process.argv[1]?.endsWith("vp-migrate-pins.ts")) {
  main();
}
