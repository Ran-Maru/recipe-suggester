export function viteBase(raw: string = process.env.VITE_BASE ?? "/"): string {
  if (raw === "/" || raw === "") {
    return "/";
  }
  return raw.endsWith("/") ? raw : `${raw}/`;
}
