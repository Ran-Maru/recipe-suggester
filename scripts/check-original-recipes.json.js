import * as fs from "fs";
import * as path from "path";

const ORIGINAL_FILE = "src/original-recipes.json";
const MAPPING_FILE = "src/mapping.json";
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function familyRecipeUrl(id) {
  return `./family-recipe/${id}`;
}

function readJson(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf-8"));
}

try {
  const originals = readJson(ORIGINAL_FILE);
  const mapping = readJson(MAPPING_FILE);
  const errors = [];

  if (!Array.isArray(originals)) {
    throw new Error("ルートが配列ではありません");
  }
  if (!Array.isArray(mapping)) {
    throw new Error(`${MAPPING_FILE} のルートが配列ではありません`);
  }

  const mappingUrls = new Set(
    mapping.flatMap((item) =>
      item !== null && typeof item === "object" && typeof item.url === "string"
        ? [item.url]
        : [],
    ),
  );
  const seenIds = new Set();

  originals.forEach((item, index) => {
    if (typeof item !== "object" || item === null) {
      errors.push(`[${index}] オブジェクトではありません`);
      return;
    }

    if (typeof item.id !== "string" || !ID_PATTERN.test(item.id)) {
      errors.push(`[${index}] id が不正です: ${JSON.stringify(item.id)}`);
    } else if (seenIds.has(item.id)) {
      errors.push(`[${index}] id が重複しています: ${item.id}`);
    } else {
      seenIds.add(item.id);
      const url = familyRecipeUrl(item.id);
      if (mappingUrls.has(url)) {
        errors.push(`[${index}] url が mapping.json と重なります: ${url}`);
      }
    }

    ["title", "kana"].forEach((key) => {
      if (typeof item[key] !== "string" || item[key].trim() === "") {
        errors.push(
          `[${index}] ${key} が不正です: ${JSON.stringify(item[key])}`,
        );
      }
    });

    if (typeof item.memo !== "string") {
      errors.push(`[${index}] memo が不正です: ${JSON.stringify(item.memo)}`);
    }

    if (!Array.isArray(item.paragraphs) || item.paragraphs.length === 0) {
      errors.push(
        `[${index}] paragraphs が不正です: ${JSON.stringify(item.paragraphs)}`,
      );
      return;
    }

    item.paragraphs.forEach((paragraph, paragraphIndex) => {
      if (typeof paragraph !== "string" || paragraph.trim() === "") {
        errors.push(
          `[${index}] paragraphs[${paragraphIndex}] が不正です: ${JSON.stringify(paragraph)}`,
        );
      }
    });
  });

  if (errors.length > 0) {
    throw new Error(`テスト失敗:\n${errors.join("\n")}`);
  }
  process.exit(0);
} catch (error) {
  console.error(`❌ ${ORIGINAL_FILE} のパースに失敗しました:`, error.message);
  process.exit(1);
}
