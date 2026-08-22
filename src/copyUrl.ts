export function toAbsoluteUrl(url: string): string {
  return new URL(url, window.location.href).href;
}

export async function copyUrl(url: string) {
  await navigator.clipboard.writeText(toAbsoluteUrl(url));
}
