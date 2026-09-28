import { describe, expect, it } from "vite-plus/test";
import mapping from "./mapping.json" with { type: "json" };
import originalRecipes from "./original-recipes.json" with { type: "json" };
import { loadRecipes } from "./loadRecipes.ts";

describe("loadRecipes", () => {
  it("keeps mapping entries and appends うちの餃子 once", () => {
    const loaded = loadRecipes();
    const gyoza = loaded.filter((recipe) => recipe.title === "うちの餃子");

    expect(loaded.slice(0, mapping.length)).toEqual(mapping);
    expect(loaded).toHaveLength(mapping.length + originalRecipes.length);
    expect(gyoza).toEqual([
      {
        title: "うちの餃子",
        kana: "うちのぎょうざ",
        url: "./family-recipe/gyoza",
        memo: "",
      },
    ]);
  });

  it("builds the catalog url from the id", () => {
    expect(
      loadRecipes(
        [],
        [
          {
            id: "nikujaga",
            title: "うちの肉じゃが",
            kana: "うちのにくじゃが",
            memo: "翌日の方がおいしい",
            paragraphs: ["じゃがいも", "玉ねぎ"],
          },
        ],
      ),
    ).toEqual([
      {
        title: "うちの肉じゃが",
        kana: "うちのにくじゃが",
        url: "./family-recipe/nikujaga",
        memo: "翌日の方がおいしい",
      },
    ]);
  });
});
