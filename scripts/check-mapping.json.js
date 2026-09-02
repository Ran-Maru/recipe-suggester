import * as fs from "fs";
import * as path from "path";

// 対象のJSONファイル名をここで固定
const TARGET_FILE = "src/mapping.json";

try {
  const absolutePath = path.resolve(process.cwd(), TARGET_FILE);
  const fileContent = fs.readFileSync(absolutePath, "utf-8");

  // JSONの構文チェック
  const array = JSON.parse(fileContent);

  const errors = [];
  array.forEach((item, index) => {
    if (typeof item !== "object" || item === null) {
      errors.push(`[${index}] オブジェクトではありません`);
      return;
    }
    // title、url、kanaの存在チェック
    ["title", "url", "kana"].forEach((key) => {
      if (typeof item[key] !== "string" || item[key].trim() === "") {
        errors.push(
          `[${index}] ${key} が不正です: ${JSON.stringify(item[key])}`,
        );
      }
    });
  });
  if (errors.length > 0) {
    throw new Error(`テスト失敗:\n${errors.join("\n")}`);
  }
  process.exit(0);
} catch (error) {
  console.error(`❌ ${TARGET_FILE} のパースに失敗しました:`, error.message);
  process.exit(1); // 失敗をGitHub Actionsに通知
}
