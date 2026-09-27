---
name: recipe-mapping
description: >-
  Adds or updates recipe entries in src/mapping.json for recipe-suggester.
  Use when adding recipes, editing mapping.json, validating recipe data, or
  when the user mentions レシピ追加, mapping, or recipe URLs.
---

# レシピの mapping

`recipe-suggester` は `src/mapping.json` からレシピをランダムに選ぶ。バックエンドはなく、このファイルが唯一のレシピデータだ。

## スキーマ

`src/mapping.json` は JSON 配列。各要素は次のフィールドを持つオブジェクトにする。

| フィールド | 型     | ルール                                    |
| ---------- | ------ | ----------------------------------------- |
| `title`    | string | trim 後に空でない（UI に出す料理名）      |
| `kana`     | string | trim 後に空でない（検索用のひらがな読み） |
| `url`      | string | trim 後に空でない（レシピページの URL）   |

例:

```json
{
  "title": "しょうが焼き",
  "kana": "しょうがやき",
  "url": "https://park.ajinomoto.co.jp/recipe/card/706344/"
}
```

## 検証

`scripts/check-mapping.json.js` は `vp run check` の一部として走り、次を確認する。

1. JSON として正しい
2. ルートが配列である
3. 各要素が null でないオブジェクトである
4. 各要素の `title`、`url`、`kana` が空でない文字列である

失敗すると、何件目かを示したエラーを出して、終了コード 1 で止まる。

## 手順

1. `src/mapping.json` を編集する。エントリを足すか、既存を更新する。JSON として正しい形を保つ（末尾カンマは不正）。
2. `vp run check` で lint、型チェック、mapping の検証をまとめて走らせる。
3. UI の挙動を変えたときは `vp test` と Playwright E2E を実行する（`playwright-e2e` スキルを参照）。

## 補足

- URL は外部の `https://` リンクでも、アプリ内レシピが使う同一オリジンのパスでもよい。
- `/recipes` の一覧も同じファイルを読む。新しいエントリはビルド後、自動でそこに出る。
