import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { toAbsoluteUrl } from "./copyUrl.ts";

describe("toAbsoluteUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps absolute https URLs", () => {
    vi.stubGlobal("window", {
      location: { href: "http://localhost:5173/" },
    });

    expect(toAbsoluteUrl("https://example.com/recipe")).toBe(
      "https://example.com/recipe",
    );
  });

  it("resolves relative URLs against the current origin", () => {
    vi.stubGlobal("window", {
      location: { href: "http://localhost:5173/" },
    });

    expect(toAbsoluteUrl("/family-recipe/gyoza")).toBe(
      "http://localhost:5173/family-recipe/gyoza",
    );
  });
});
