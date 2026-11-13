import { describe, expect, it } from "vite-plus/test";
import {
  combineInstallStatus,
  parsePlaywrightVersion,
} from "./playwright-ci.ts";

describe("parsePlaywrightVersion", () => {
  it("Version 接頭辞を外す", () => {
    expect(parsePlaywrightVersion("Version 1.65.0\n")).toBe("1.65.0");
  });

  it("接頭辞が無くても読む", () => {
    expect(parsePlaywrightVersion("1.65.0")).toBe("1.65.0");
  });

  it("プレリリースを読む", () => {
    expect(parsePlaywrightVersion("Version 1.65.0-alpha.1")).toBe(
      "1.65.0-alpha.1",
    );
  });

  it("読めない文字列は失敗する", () => {
    expect(() => parsePlaywrightVersion("Version latest")).toThrow(
      "Playwright のバージョンを読めませんでした: latest",
    );
  });
});

describe("combineInstallStatus", () => {
  it("両方成功なら 0", () => {
    expect(combineInstallStatus(0, 0)).toBe(0);
  });

  it("install の失敗を優先する", () => {
    expect(combineInstallStatus(2, 3)).toBe(2);
  });

  it("install が成功なら依存関係のコードを返す", () => {
    expect(combineInstallStatus(0, 4)).toBe(4);
  });
});
