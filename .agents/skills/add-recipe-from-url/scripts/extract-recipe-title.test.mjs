import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanRecipeName,
  cleanUrl,
  describeHtml,
  findDuplicate,
  sameRecipeUrl,
} from "./extract-recipe-title.mjs";

test("宣伝とサイト名を外して料理名にする", () => {
  assert.equal(cleanRecipeName("基本の豚のしょうが焼き"), "豚のしょうが焼き");
  assert.equal(
    cleanRecipeName("シャキシャキ甘辛♪ えのき肉巻き"),
    "えのき肉巻き",
  );
  assert.equal(
    cleanRecipeName("シャキシャキ甘辛♪えのき肉巻き"),
    "えのき肉巻き",
  );
  assert.equal(cleanRecipeName("基本の肉じゃが"), "肉じゃが");
  assert.equal(
    cleanRecipeName("簡単！とろとろの絶品ロールキャベツ"),
    "ロールキャベツ",
  );
  assert.equal(
    cleanRecipeName(
      "【豚たまキャベツの旨だれ炒め】ご飯に合う！キャベツたっぷり♪",
    ),
    "豚たまキャベツの旨だれ炒め",
  );
  assert.equal(
    cleanRecipeName("ひき肉のれんこんはさみ焼き【おべんとうにも人気のおかず】"),
    "ひき肉のれんこんはさみ焼き",
  );
  assert.equal(cleanRecipeName("基本の肉じゃが　レシピ・作り方"), "肉じゃが");
  assert.equal(
    cleanRecipeName(
      "定番おかず！基本の豚のしょうが焼きの作り方 | レシピ |【味の素パーク】",
    ),
    "豚のしょうが焼き",
  );
  assert.equal(
    cleanRecipeName("簡単！とろとろの絶品ロールキャベツ by チョリベー"),
    "ロールキャベツ",
  );
  assert.equal(
    cleanRecipeName("厚切りフレンチトースト"),
    "厚切りフレンチトースト",
  );
  assert.equal(cleanRecipeName("豚汁"), "豚汁");
});

test("JSON-LD の Recipe.name を料理名にする", () => {
  const html = `<!doctype html>
<html><head>
<title>定番おかず！基本の豚のしょうが焼きの作り方 | レシピ |【味の素パーク】</title>
<meta property="og:title" content="定番おかず！基本の豚のしょうが焼きの作り方 | レシピ |【味の素パーク】">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Recipe","name":"基本の豚のしょうが焼き"}
</script>
</head><body><h1>基本の豚のしょうが焼き</h1></body></html>`;
  const described = describeHtml(
    html,
    "https://example.com/recipe",
    "https://example.com/recipe",
    [],
  );
  assert.equal(described.ok, true);
  assert.equal(described.title, "豚のしょうが焼き");
  assert.equal(described.source, "json-ld");
  assert.equal(described.needsReview, false);
});

test("構造化データが無いページは確認にする", () => {
  const html = `<!doctype html><html><head>
<title>今日の夕飯 | あるブログ</title>
<meta property="og:title" content="今日の夕飯 | あるブログ">
</head><body><p>本文</p></body></html>`;
  const described = describeHtml(
    html,
    "https://example.com/post",
    "https://example.com/post",
    [],
  );
  assert.equal(described.source, "og:title");
  assert.equal(described.title, "今日の夕飯");
  assert.equal(described.needsReview, true);
});

test("JSON-LD と h1 の料理名が違うときは確認にする", () => {
  const html = `<!doctype html><html><head>
<script type="application/ld+json">{"@type":"Recipe","name":"肉じゃが"}</script>
</head><body><h1>カレー</h1></body></html>`;
  const described = describeHtml(
    html,
    "https://example.com/a",
    "https://example.com/a",
    [],
  );
  assert.equal(described.needsReview, true);
  assert.deepEqual(described.titles, ["肉じゃが", "カレー"]);
});

test("追跡パラメータと末尾スラッシュを無視して同じ URL とみなす", () => {
  const left =
    "https://example.com/recipe/1/?utm_source=x&srsltid=abc&CODE=1#top";
  const right = "http://example.com/recipe/1?CODE=1";
  assert.equal(sameRecipeUrl(left, right), true);
  assert.equal(cleanUrl(left), "https://example.com/recipe/1/?CODE=1");
  assert.equal(
    sameRecipeUrl(
      "https://example.com/recipe/1",
      "https://example.com/recipe/2",
    ),
    false,
  );
});

test("同じ URL が mapping にあれば既存の料理名を返す", () => {
  const recipes = [
    {
      title: "肉じゃが",
      url: "https://example.com/recipe/1/",
    },
  ];
  assert.deepEqual(
    findDuplicate(
      "https://example.com/recipe/1?utm_source=newsletter",
      recipes,
    ),
    { title: "肉じゃが", url: "https://example.com/recipe/1/" },
  );
  assert.equal(findDuplicate("https://example.com/recipe/9", recipes), null);
});
