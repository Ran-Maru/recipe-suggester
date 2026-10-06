---
name: recipe-mapping
description: >-
  Adds or updates recipe entries in src/mapping.json or
  src/original-recipes.json for recipe-suggester. Use when adding recipes,
  editing mapping.json, validating recipe data, or when the user mentions
  レシピ追加, mapping, original recipes, or recipe URLs.
---

# レシピの mapping

`recipe-suggester` はレシピをランダムに選ぶ。バックエンドはない。外部サイトのリンクは `src/mapping.json`、うちのレシピの本文は `src/original-recipes.json` に置く。画面が読む一覧は、この2つを `src/loadRecipes.ts` で結合したものだ。

## 外部レシピ

`src/mapping.json` は JSON 配列。各要素は次のフィールドを持つオブジェクトにする。

| フィールド | 型     | ルール                                                        |
| ---------- | ------ | ------------------------------------------------------------- |
| `title`    | string | trim 後に空でない（UI に出す料理名）                          |
| `kana`     | string | trim 後に空でない（検索用のひらがな読み）                     |
| `url`      | string | trim 後に空でない（レシピページの URL）                       |
| `memo`     | string | 空文字可。trim 後に中身があるときだけ一覧にメモアイコンを出す |

例:

```json
{
  "title": "しょうが焼き",
  "kana": "しょうがやき",
  "url": "https://park.ajinomoto.co.jp/recipe/card/706344/",
  "memo": ""
}
```

URL は外部の `https://` リンクにする。アプリ内のオリジナルレシピは、このファイルに URL を手書きしない。

## オリジナルレシピ

`src/original-recipes.json` に1件足すと、レシピGET、一覧、`/family-recipe/${id}` に載る。ルートファイルは足さない。

| フィールド   | 型       | ルール                                                           |
| ------------ | -------- | ---------------------------------------------------------------- |
| `id`         | string   | `^[a-z0-9]+(?:-[a-z0-9]+)*$`。ファイル内で一意。URL の末尾になる |
| `title`      | string   | trim 後に空でない                                                |
| `kana`       | string   | trim 後に空でない                                                |
| `memo`       | string   | 空文字可。一覧のメモ列は mapping と同じルール                    |
| `paragraphs` | string[] | 1件以上。各要素は trim 後に空でない。ページの本文になる          |

一覧に出る URL は `./family-recipe/${id}`。`src/loadRecipes.ts` が付ける。

例:

```json
{
  "id": "gyoza",
  "title": "うちの餃子",
  "kana": "うちのぎょうざ",
  "memo": "",
  "paragraphs": [
    "白菜、ニラ、豚ミンチ、中華系（ダシダとか）少々 ごま油少々、醤油少々",
    "野菜多めにして、にんにく、しょうがは好きなように"
  ]
}
```

`id` を `gyoza` にすると公開パスは `/family-recipe/gyoza` になる。

## 検証

`vp run check` は次の2本を続ける。

`scripts/check-mapping.json.js` は `src/mapping.json` を確認する。

1. JSON として正しい
2. ルートが配列である
3. 各要素が null でないオブジェクトである
4. 各要素の `title`、`url`、`kana` が空でない文字列である
5. 各要素の `memo` が文字列である（空文字は可）

`scripts/check-original-recipes.json.js` は `src/original-recipes.json` を確認する。

1. JSON として正しい
2. ルートが配列である
3. 各要素が null でないオブジェクトである
4. `id` が空でなく、一意で、`^[a-z0-9]+(?:-[a-z0-9]+)*$` に合う
5. `title` と `kana` が空でない文字列である
6. `memo` が文字列である（空文字は可）
7. `paragraphs` が、空でない文字列を1つ以上持つ
8. 生成した `./family-recipe/${id}` が `mapping.json` の `url` と重ならない

失敗すると、何件目かを示したエラーを出して、終了コード 1 で止まる。

## 手順

外部サイトのレシピ:

1. `src/mapping.json` を編集する。エントリを足すか、既存を更新する。JSON として正しい形を保つ（末尾カンマは不正）。
2. `vp run check` で lint、型チェック、両方の JSON 検証をまとめて走らせる。
3. UI の挙動を変えたときは `vp test` と Playwright E2E を実行する（`playwright-e2e` スキルを参照）。

オリジナルレシピ:

1. `src/original-recipes.json` にオブジェクトを足す。`id` は英小文字とハイフンにする。
2. `vp run check` を走らせる。
3. `/family-recipe/${id}` で本文が出ること、一覧のリンクが `./family-recipe/${id}` であることを確認する。

## 補足

- `/recipes` の一覧は結合後の配列を読む。新しいエントリはビルド後、自動でそこに出る。
- オリジナルレシピのページは `src/routes/family-recipe.$id.tsx` の1枚。未知の `id` は「レシピが見つかりません」と出す。
- 変更が `src/mapping.json` と `src/original-recipes.json` への追加だけで、既存の要素を直したり消したりしていない PR は、CI が成功すると main へ squash マージされる。その main の CI が成功すると GitHub Pages に出る。
- 下書き、フォークからの PR、`no-auto-merge` ラベル、既存レシピの修正や削除は自動ではマージしない。辞書やテストも一緒に変えた PR も対象外。下書きは Ready for review にしたあと、そのコミットの CI が既に成功していればマージする。
