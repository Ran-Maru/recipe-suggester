export type Recipe = {
  title: string;
  kana: string;
  url: string;
  addedDate?: string;
};

/** Normalize text for case-insensitive partial match (katakana → hiragana, ignore spaces). */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60),
    )
    .replace(/\s+/g, "");
}

export function searchRecipes<T extends Pick<Recipe, "title" | "kana">>(
  recipes: T[],
  query: string,
): T[] {
  const normalizedQuery = normalizeForSearch(query.trim());
  if (normalizedQuery === "") {
    return recipes;
  }

  return recipes.filter((recipe) => {
    const title = normalizeForSearch(recipe.title);
    const kana = normalizeForSearch(recipe.kana);
    return title.includes(normalizedQuery) || kana.includes(normalizedQuery);
  });
}
