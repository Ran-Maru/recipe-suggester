import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PWA_DISPLAY, PWA_ICONS, PWA_NAME } from "./pwa-manifest.ts";
import { viteBase } from "./vite-base.ts";

export type PwaIcon = {
  src: string;
  sizes: string;
  purpose?: string;
};

export type PwaManifest = {
  name: string;
  display: string;
  start_url: string;
  scope: string;
  id: string;
  icons: readonly PwaIcon[];
};

export type PwaDistInput = {
  base: string;
  manifest: PwaManifest;
  serviceWorker: string;
  indexHtml: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`manifest の ${key} がありません`);
  }
  return value;
}

export function parsePwaManifest(value: unknown): PwaManifest {
  if (!isRecord(value)) {
    throw new Error("manifest がオブジェクトではありません");
  }
  if (!Array.isArray(value.icons)) {
    throw new Error("manifest の icons がありません");
  }
  const icons = value.icons.map((icon) => {
    if (!isRecord(icon)) {
      throw new Error("manifest の icon がオブジェクトではありません");
    }
    const purpose = icon.purpose;
    return {
      src: readString(icon, "src"),
      sizes: readString(icon, "sizes"),
      ...(typeof purpose === "string" ? { purpose } : {}),
    };
  });
  return {
    name: readString(value, "name"),
    display: readString(value, "display"),
    start_url: readString(value, "start_url"),
    scope: readString(value, "scope"),
    id: readString(value, "id"),
    icons,
  };
}

function hasRegistration(indexHtml: string): boolean {
  return (
    indexHtml.includes('id="vite-plugin-pwa:register-sw"') ||
    indexHtml.includes("navigator.serviceWorker.register")
  );
}

export function checkPwaDist(input: PwaDistInput): readonly string[] {
  const errors: string[] = [];
  if (input.manifest.name !== PWA_NAME) {
    errors.push(`name が ${PWA_NAME} ではありません`);
  }
  if (input.manifest.display !== PWA_DISPLAY) {
    errors.push(`display が ${PWA_DISPLAY} ではありません`);
  }
  if (input.manifest.start_url !== input.base) {
    errors.push(`start_url が ${input.base} ではありません`);
  }
  if (input.manifest.scope !== input.base) {
    errors.push(`scope が ${input.base} ではありません`);
  }
  if (input.manifest.id !== input.base) {
    errors.push(`id が ${input.base} ではありません`);
  }
  for (const icon of PWA_ICONS) {
    const src = `${input.base}${icon.fileName}`;
    const found = input.manifest.icons.some(
      (item) =>
        item.src === src &&
        item.sizes === icon.sizes &&
        item.purpose === icon.purpose,
    );
    if (!found) {
      errors.push(
        `icons に ${src} (${icon.sizes}, ${icon.purpose}) がありません`,
      );
    }
  }
  const manifestHref = `${input.base}manifest.webmanifest`;
  if (
    !input.indexHtml.includes('rel="manifest"') ||
    !input.indexHtml.includes(manifestHref)
  ) {
    errors.push(`index.html が ${manifestHref} を参照していません`);
  }
  if (!hasRegistration(input.indexHtml)) {
    errors.push("index.html に Service Worker の登録がありません");
  }
  if (!input.serviceWorker.includes("index.html")) {
    errors.push("sw.js が index.html を precache していません");
  }
  return errors;
}

function main(): void {
  const distDir = process.argv[2] ?? "dist";
  const manifest = parsePwaManifest(
    JSON.parse(
      readFileSync(path.join(distDir, "manifest.webmanifest"), "utf8"),
    ),
  );
  const errors = checkPwaDist({
    base: viteBase(),
    manifest,
    serviceWorker: readFileSync(path.join(distDir, "sw.js"), "utf8"),
    indexHtml: readFileSync(path.join(distDir, "index.html"), "utf8"),
  });
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
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
    main();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
