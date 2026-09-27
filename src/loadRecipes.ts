import mappingJson from "./mapping.json" with { type: "json" };
import originalRecipesJson from "./original-recipes.json" with { type: "json" };
import type { Recipe } from "./searchRecipes.ts";

export type OriginalRecipe = {
  id: string;
  title: string;
  kana: string;
  memo: string;
  paragraphs: readonly string[];
};

export function familyRecipeUrl(id: string): string {
  return `./family-recipe/${id}`;
}

export function toCatalogRecipe(recipe: OriginalRecipe): Recipe {
  return {
    title: recipe.title,
    kana: recipe.kana,
    url: familyRecipeUrl(recipe.id),
    memo: recipe.memo,
  };
}

export function loadRecipes(
  links: readonly Recipe[] = mappingJson,
  originals: readonly OriginalRecipe[] = originalRecipesJson,
): Recipe[] {
  return [...links, ...originals.map(toCatalogRecipe)];
}

export function findOriginalRecipe(
  id: string,
  originals: readonly OriginalRecipe[] = originalRecipesJson,
): OriginalRecipe | undefined {
  return originals.find((recipe) => recipe.id === id);
}

export const recipes = loadRecipes();
