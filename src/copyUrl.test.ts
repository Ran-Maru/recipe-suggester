import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { toAbsoluteUrl } from "./copyUrl.ts";

describe("toAbsoluteUrl", () => {
  const origin = "http://127.0.0.1:5500/";

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps absolute https URLs", () => {
    vi.stubGlobal("window", {
      location: { href: origin },
    });

    expect(toAbsoluteUrl("https://example.com/recipe")).toBe(
      "https://example.com/recipe",
    );
  });

  it("resolves relative URLs against the current origin", () => {
    vi.stubGlobal("window", {
      location: { href: origin },
    });

    expect(toAbsoluteUrl("/family-recipe/gyoza")).toBe(
      "http://127.0.0.1:5500/family-recipe/gyoza",
    );
  });
});
