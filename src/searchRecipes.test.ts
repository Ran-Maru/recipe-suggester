import { describe, expect, it } from "vite-plus/test";
import { searchRecipes } from "./searchRecipes.ts";

const recipes = [
  { title: "しょうが焼き", kana: "しょうがやき" },
  { title: "豚汁", kana: "とんじる" },
  { title: "キャベツ炒め", kana: "きゃべついため" },
];

describe("searchRecipes", () => {
  it("returns all recipes when the query is empty", () => {
    expect(searchRecipes(recipes, "")).toEqual(recipes);
    expect(searchRecipes(recipes, "   ")).toEqual(recipes);
  });

  it("matches a title substring", () => {
    expect(
      searchRecipes(recipes, "しょうが").map((recipe) => recipe.title),
    ).toEqual(["しょうが焼き"]);
  });

  it("matches a kana substring", () => {
    expect(
      searchRecipes(recipes, "とんじる").map((recipe) => recipe.title),
    ).toEqual(["豚汁"]);
  });

  it("ignores dakuten and handakuten", () => {
    expect(
      searchRecipes(recipes, "しようかやき").map((recipe) => recipe.title),
    ).toEqual(["しょうが焼き"]);
    expect(
      searchRecipes(recipes, "とんしる").map((recipe) => recipe.title),
    ).toEqual(["豚汁"]);
  });

  it("treats small kana as large kana", () => {
    expect(
      searchRecipes(recipes, "きやべつ").map((recipe) => recipe.title),
    ).toEqual(["キャベツ炒め"]);
  });
});
