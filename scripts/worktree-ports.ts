import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

export const DEV_PORT_BASE = 5173;
export const PREVIEW_PORT_BASE = 4173;
export const PLAYWRIGHT_HTML_PORT_BASE = 9323;
export const VITEST_BROWSER_API_PORT_BASE = 63315;
export const WORKTREE_PORT_RANGE = 500;

type Env = Record<string, string | undefined>;

export function cloudAgentSocketPath(env: Env = process.env): string {
  return env.CURSOR_AGENT_SOCKET ?? "/run/cursor/api.sock";
}

export function isIsolatedAgentEnvironment(
  env: Env = process.env,
  socketPath: string = cloudAgentSocketPath(env),
): boolean {
  return Boolean(env.CI) || existsSync(socketPath);
}

function parsePort(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port >= 65536) {
    return undefined;
  }
  return port;
}

export function worktreePortOffset(
  cwd: string = process.cwd(),
  env: Env = process.env,
  socketPath: string = cloudAgentSocketPath(env),
): number {
  if (isIsolatedAgentEnvironment(env, socketPath)) {
    return 0;
  }
  const digest = createHash("sha256").update(cwd).digest();
  return digest.readUInt16BE(0) % WORKTREE_PORT_RANGE;
}

export function worktreePort(
  base: number,
  envNames: readonly string[] = [],
  options: { cwd?: string; env?: Env; socketPath?: string } = {},
): number {
  const env = options.env ?? process.env;
  for (const name of envNames) {
    const parsed = parsePort(env[name]);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  return (
    base +
    worktreePortOffset(
      options.cwd ?? process.cwd(),
      env,
      options.socketPath ?? cloudAgentSocketPath(env),
    )
  );
}

export function worktreeDevPort(
  options: { cwd?: string; env?: Env; socketPath?: string } = {},
): number {
  return worktreePort(DEV_PORT_BASE, ["VITE_DEV_PORT", "PORT"], options);
}

export function worktreePreviewPort(
  options: { cwd?: string; env?: Env; socketPath?: string } = {},
): number {
  return worktreePort(PREVIEW_PORT_BASE, ["PREVIEW_PORT"], options);
}

export function worktreePlaywrightHtmlPort(
  options: { cwd?: string; env?: Env; socketPath?: string } = {},
): number {
  return worktreePort(
    PLAYWRIGHT_HTML_PORT_BASE,
    ["PLAYWRIGHT_HTML_PORT"],
    options,
  );
}

export function worktreeVitestBrowserApiPort(
  options: { cwd?: string; env?: Env; socketPath?: string } = {},
): number {
  return worktreePort(
    VITEST_BROWSER_API_PORT_BASE,
    ["VITEST_BROWSER_API_PORT"],
    options,
  );
}
