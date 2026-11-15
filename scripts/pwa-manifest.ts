export const PWA_NAME = "レシピGET!";
export const PWA_SHORT_NAME = "レシピGET";
export const PWA_DESCRIPTION = "美味しかったレシピのURLをまとめたサイト";
export const PWA_THEME_COLOR = "#646cff";
export const PWA_BACKGROUND_COLOR = "#ffffff";
export const PWA_DISPLAY = "standalone" as const;
export const PWA_LANG = "ja" as const;

export const PWA_ICONS = [
  { fileName: "pwa-192x192.png", sizes: "192x192", purpose: "any" },
  { fileName: "pwa-512x512.png", sizes: "512x512", purpose: "any" },
  {
    fileName: "pwa-maskable-512x512.png",
    sizes: "512x512",
    purpose: "maskable",
  },
] as const;

export const PWA_INCLUDE_ASSETS = [
  "recipe-get.svg",
  ...PWA_ICONS.map((icon) => icon.fileName),
  "apple-touch-icon-180x180.png",
] as const;

export function manifestIcons(base: string): {
  src: string;
  sizes: string;
  type: "image/png";
  purpose: "any" | "maskable";
}[] {
  return PWA_ICONS.map((icon) => ({
    src: `${base}${icon.fileName}`,
    sizes: icon.sizes,
    type: "image/png",
    purpose: icon.purpose,
  }));
}
