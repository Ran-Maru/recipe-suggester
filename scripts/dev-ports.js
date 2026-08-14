import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_DEV_PORT = 5173;
export const DEFAULT_REPORT_PORT = 9323;
export const DEFAULT_UI_PORT = 8080;
export const DEFAULT_PREVIEW_PORT = 4173;

/**
 * Linked git worktrees store `.git` as a file, not a directory.
 * The primary clone (and CI / Dev Container checkouts) keep `.git` as a directory.
 *
 * @param {string} [cwd]
 * @returns {boolean}
 */
export function isLinkedWorktree(cwd = process.cwd()) {
  try {
    return fs.lstatSync(path.join(cwd, ".git")).isFile();
  } catch {
    return false;
  }
}

/**
 * @param {string} [cwd]
 * @returns {number} 1–99 so worktrees never reuse the primary 5173
 */
function worktreeOffset(cwd = process.cwd()) {
  const hash = createHash("sha1").update(cwd).digest();
  return 1 + (hash.readUInt16BE(0) % 99);
}

/**
 * @returns {number | null}
 */
function offsetFromEnv() {
  const raw = process.env.DEV_PORT ?? process.env.PORT;
  if (raw === undefined || raw === "") {
    return null;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid DEV_PORT/PORT: ${raw}`);
  }
  return port - DEFAULT_DEV_PORT;
}

export function portOffset() {
  if (process.env.CI) {
    return 0;
  }
  const fromEnv = offsetFromEnv();
  if (fromEnv !== null) {
    return fromEnv;
  }
  if (isLinkedWorktree()) {
    return worktreeOffset();
  }
  return 0;
}

/**
 * @returns {{ dev: number, report: number, ui: number, preview: number }}
 */
export function devPorts() {
  const offset = portOffset();
  return {
    dev: DEFAULT_DEV_PORT + offset,
    report: DEFAULT_REPORT_PORT + offset,
    ui: DEFAULT_UI_PORT + offset,
    preview: DEFAULT_PREVIEW_PORT + offset,
  };
}

export function devOrigin() {
  return `http://localhost:${devPorts().dev}`;
}

function isMain() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return fileURLToPath(import.meta.url) === path.resolve(entry);
}

/**
 * @param {string[]} args
 */
function runPlaywright(args) {
  const cli = fileURLToPath(import.meta.resolve("playwright/cli.js"));
  const child = spawn(process.execPath, [cli, ...args], { stdio: "inherit" });
  child.on("exit", (code) => {
    process.exit(code ?? 1);
  });
}

if (isMain()) {
  const ports = devPorts();
  const command = process.argv[2];

  if (command === "show-report") {
    runPlaywright([
      "show-report",
      "--host",
      "0.0.0.0",
      "--port",
      String(ports.report),
    ]);
  } else if (command === "test-ui") {
    runPlaywright([
      "test",
      "--trace",
      "on",
      "--ui",
      "--ui-host",
      "0.0.0.0",
      "--ui-port",
      String(ports.ui),
    ]);
  } else if (
    command === "dev" ||
    command === "report" ||
    command === "ui" ||
    command === "preview"
  ) {
    console.log(ports[command]);
  } else {
    console.log(JSON.stringify(ports, null, 2));
  }
}
