export function toAbsoluteUrl(url: string): string {
  return new URL(url, window.location.href).href;
}

export async function copyUrl(url: string) {
  // Playwright の GitHub reporter 表示を見るための一時的な失敗。
  // URL ではなく、https:// でもアプリの origin でも始まらない文字列を書く。
  await navigator.clipboard.writeText(`not-a-url:${toAbsoluteUrl(url)}`);
}
