import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  DEV_PORT_BASE,
  WORKTREE_PORT_RANGE,
  worktreeDevPort,
  worktreePortOffset,
} from "./worktree-ports.ts";

const missingSocket = "/tmp/recipe-suggester-missing-cursor-agent.sock";
const portsSh = path.resolve(import.meta.dirname, "worktree-ports.sh");

function bashEnv(
  extra: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    CURSOR_AGENT_SOCKET: missingSocket,
    ...extra,
  };
}

function bashOffset(cwd: string): number {
  return Number(
    execFileSync(
      "bash",
      ["-c", `source "${portsSh}" && worktree_port_offset "$1"`, "bash", cwd],
      { encoding: "utf8", env: bashEnv() },
    ).trim(),
  );
}

function bashDevPort(
  cwd: string,
  extra: Record<string, string | undefined> = {},
): number {
  return Number(
    execFileSync(
      "bash",
      [
        "-c",
        `source "${portsSh}" && WORKTREE_PORT_CWD="$1" worktree_dev_port`,
        "bash",
        cwd,
      ],
      { encoding: "utf8", env: bashEnv(extra) },
    ).trim(),
  );
}

describe("worktreePortOffset", () => {
  it("returns 0 when CI is set", () => {
    expect(
      worktreePortOffset("/tmp/worktree-a", { CI: "true" }, missingSocket),
    ).toBe(0);
  });

  it("is stable for the same cwd and in range", () => {
    const first = worktreePortOffset("/tmp/worktree-a", {}, missingSocket);
    const second = worktreePortOffset("/tmp/worktree-a", {}, missingSocket);
    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(WORKTREE_PORT_RANGE);
  });

  it("matches the shell helper", () => {
    const cwd = "/tmp/worktree-ports-sync";
    expect(worktreePortOffset(cwd, {}, missingSocket)).toBe(bashOffset(cwd));
  });
});

describe("worktreeDevPort", () => {
  it("uses VITE_DEV_PORT over PORT", () => {
    const options = {
      cwd: "/tmp/worktree-a",
      env: { VITE_DEV_PORT: "6000", PORT: "7000" },
      socketPath: missingSocket,
    };
    expect(worktreeDevPort(options)).toBe(6000);
    expect(bashDevPort(options.cwd, options.env)).toBe(6000);
  });

  it("uses PORT when VITE_DEV_PORT is unset", () => {
    const options = {
      cwd: "/tmp/worktree-a",
      env: { PORT: "7000" },
      socketPath: missingSocket,
    };
    expect(worktreeDevPort(options)).toBe(7000);
    expect(bashDevPort(options.cwd, options.env)).toBe(7000);
  });

  it("adds the worktree offset to the dev base port when not isolated", () => {
    const cwd = "/tmp/worktree-a";
    const offset = worktreePortOffset(cwd, {}, missingSocket);
    expect(
      worktreeDevPort({
        cwd,
        env: {},
        socketPath: missingSocket,
      }),
    ).toBe(DEV_PORT_BASE + offset);
    expect(bashDevPort(cwd)).toBe(DEV_PORT_BASE + offset);
  });
});
