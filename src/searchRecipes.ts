export type Recipe = {
  title: string;
  kana: string;
  url: string;
  addedDate?: string;
};

const SMALL_TO_LARGE_KANA: Record<string, string> = {
  ぁ: "あ",
  ぃ: "い",
  ぅ: "う",
  ぇ: "え",
  ぉ: "お",
  っ: "つ",
  ゃ: "や",
  ゅ: "ゆ",
  ょ: "よ",
  ゎ: "わ",
};

/** Normalize text for partial match (katakana → hiragana, ignore dakuten/handakuten, small kana, spaces). */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60),
    )
    .normalize("NFD")
    .replace(/[\u3099\u309a]/g, "")
    .replace(
      /[ぁぃぅぇぉっゃゅょゎ]/g,
      (char) => SMALL_TO_LARGE_KANA[char] ?? char,
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
