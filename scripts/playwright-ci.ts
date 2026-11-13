// Playwright の版を検証し、ブラウザの導入と OS 依存の導入を並行して終了コードを合成する。
import { execFileSync, spawn } from "node:child_process";
import {
  appendFileSync,
  closeSync,
  openSync,
  readFileSync,
  realpathSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PLAYWRIGHT_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+([-+.][0-9A-Za-z.]+)?$/;

export function parsePlaywrightVersion(output: string): string {
  const text = output.trim();
  const version = text.startsWith("Version ")
    ? text.slice("Version ".length)
    : text;
  if (!PLAYWRIGHT_VERSION.test(version)) {
    throw new Error(`Playwright のバージョンを読めませんでした: ${version}`);
  }
  return version;
}

export function combineInstallStatus(
  installStatus: number,
  depsStatus: number,
): number {
  if (installStatus !== 0) {
    return installStatus;
  }
  return depsStatus;
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

function readPlaywrightVersion(): string {
  const output = execFileSync("vp", ["exec", "playwright", "--version"], {
    encoding: "utf8",
  });
  return parsePlaywrightVersion(output);
}

function runCommand(
  file: string,
  args: readonly string[],
  logFd: number | undefined,
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(file, args, {
      stdio: logFd === undefined ? "inherit" : ["ignore", logFd, logFd],
    });
    let settled = false;
    const finish = (status: number) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(status);
    };
    child.on("error", () => {
      finish(127);
    });
    child.on("close", (code) => {
      finish(code ?? 1);
    });
  });
}

async function installBrowsers(): Promise<number> {
  const logPath = path.join(
    process.env.RUNNER_TEMP ?? tmpdir(),
    "playwright-deps.log",
  );
  const logFd = openSync(logPath, "w");
  try {
    const depsStatus = runCommand(
      "vp",
      ["exec", "playwright", "install-deps", "chromium", "webkit"],
      logFd,
    );
    const installStatus = await runCommand(
      "vp",
      ["exec", "playwright", "install", "chromium", "webkit"],
      undefined,
    );
    const depsCode = await depsStatus;
    writeSync(1, readFileSync(logPath));
    return combineInstallStatus(installStatus, depsCode);
  } finally {
    closeSync(logFd);
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const command = argv[0];
  if (command === "version") {
    appendGithubOutput("version", readPlaywrightVersion());
    return 0;
  }
  if (command === "install") {
    return installBrowsers();
  }
  throw new Error("使い方: playwright-ci.ts <version|install>");
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
  void main(process.argv.slice(2))
    .then((status) => {
      process.exit(status);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exit(1);
    });
}
