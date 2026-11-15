import { describe, expect, it } from "vite-plus/test";
import { checkPwaDist, parsePwaManifest } from "./check-pwa-dist.ts";
import type { PwaManifest } from "./check-pwa-dist.ts";
import { PWA_DISPLAY, PWA_ICONS, PWA_NAME } from "./pwa-manifest.ts";
import { viteBase } from "./vite-base.ts";

function manifestFor(base: string): PwaManifest {
  return {
    name: PWA_NAME,
    display: PWA_DISPLAY,
    start_url: base,
    scope: base,
    id: base,
    icons: PWA_ICONS.map((icon) => ({
      src: `${base}${icon.fileName}`,
      sizes: icon.sizes,
      purpose: icon.purpose,
    })),
  };
}

function indexHtml(base: string): string {
  return `<link rel="manifest" href="${base}manifest.webmanifest"><script id="vite-plugin-pwa:register-sw" src="${base}registerSW.js"></script>`;
}

describe("viteBase", () => {
  it("空とルートはそのまま", () => {
    expect(viteBase("/")).toBe("/");
    expect(viteBase("")).toBe("/");
  });

  it("サブパスには末尾スラッシュを付ける", () => {
    expect(viteBase("/recipe-suggester")).toBe("/recipe-suggester/");
    expect(viteBase("/recipe-suggester/")).toBe("/recipe-suggester/");
  });
});

describe("checkPwaDist", () => {
  it("ルートと GitHub Pages の base を受け入れる", () => {
    for (const base of ["/", "/recipe-suggester/"]) {
      expect(
        checkPwaDist({
          base,
          manifest: manifestFor(base),
          serviceWorker: "precache index.html",
          indexHtml: indexHtml(base),
        }),
      ).toEqual([]);
    }
  });

  it("インライン登録も受け入れる", () => {
    const base = "/";
    expect(
      checkPwaDist({
        base,
        manifest: manifestFor(base),
        serviceWorker: "index.html",
        indexHtml: `<link rel="manifest" href="${base}manifest.webmanifest"><script>navigator.serviceWorker.register("/sw.js")</script>`,
      }),
    ).toEqual([]);
  });

  it("start_url が base と違うと失敗する", () => {
    const manifest = manifestFor("/recipe-suggester/");
    expect(
      checkPwaDist({
        base: "/recipe-suggester/",
        manifest: { ...manifest, start_url: "/" },
        serviceWorker: "index.html",
        indexHtml: indexHtml("/recipe-suggester/"),
      }),
    ).toContain("start_url が /recipe-suggester/ ではありません");
  });

  it("192 のアイコンが無いと失敗する", () => {
    const base = "/";
    const manifest = manifestFor(base);
    expect(
      checkPwaDist({
        base,
        manifest: {
          ...manifest,
          icons: manifest.icons.filter((icon) => icon.sizes !== "192x192"),
        },
        serviceWorker: "index.html",
        indexHtml: indexHtml(base),
      }).some((error) => error.includes("pwa-192x192.png")),
    ).toBe(true);
  });

  it("登録タグが無いと失敗する", () => {
    const base = "/";
    expect(
      checkPwaDist({
        base,
        manifest: manifestFor(base),
        serviceWorker: "index.html",
        indexHtml: `<link rel="manifest" href="${base}manifest.webmanifest">`,
      }),
    ).toContain("index.html に Service Worker の登録がありません");
  });

  it("sw.js がシェルを含まないと失敗する", () => {
    const base = "/";
    expect(
      checkPwaDist({
        base,
        manifest: manifestFor(base),
        serviceWorker: "empty worker",
        indexHtml: indexHtml(base),
      }),
    ).toContain("sw.js が index.html を precache していません");
  });
});

describe("parsePwaManifest", () => {
  it("必要な項目だけを読む", () => {
    expect(
      parsePwaManifest({
        name: PWA_NAME,
        display: PWA_DISPLAY,
        start_url: "/",
        scope: "/",
        id: "/",
        icons: [{ src: "/pwa-192x192.png", sizes: "192x192", purpose: "any" }],
        theme_color: "#646cff",
      }),
    ).toEqual({
      name: PWA_NAME,
      display: PWA_DISPLAY,
      start_url: "/",
      scope: "/",
      id: "/",
      icons: [{ src: "/pwa-192x192.png", sizes: "192x192", purpose: "any" }],
    });
  });

  it("icons が無いと失敗する", () => {
    expect(() => parsePwaManifest({ name: PWA_NAME })).toThrow(
      "manifest の icons がありません",
    );
  });
});
