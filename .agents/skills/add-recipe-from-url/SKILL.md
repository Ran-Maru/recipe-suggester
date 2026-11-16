---
name: add-recipe-from-url
description: >-
  Opens a recipe URL, reads the dish name from the page, and appends it to
  src/mapping.json for recipe-suggester. Use when the user gives a recipe URL
  to add, or mentions URLからレシピ追加, このURLを追加, レシピを登録,
  ページからレシピ名.
---

# URL からレシピを足す

URLを渡すとその画面にアクセスし、レシピ名を取得したうえでmapping.jsonに記載する。対象は `src/mapping.json`。項目の形は `recipe-mapping` と同じで、新しい行には `addedDate` も入れる。

アプリ内のオリジナルレシピ（本文を `src/original-recipes.json` に書くもの）は対象外。`/family-recipe/` は `recipe-mapping` に従う。

## 手順

リポジトリのルートで、渡された URL をまとめてスクリプトに渡す。

```bash
vp node .agents/skills/add-recipe-from-url/scripts/extract-recipe-title.mjs 'https://example.com/recipe/1'
```

複数あるときは引数を並べる。ネットワークが要る。標準出力は JSON 配列。終了コードが 1 でも、配列に成功した URL は入っている。

各要素について、次のどれか一つにする。

| 結果 | すること |
| --- | --- |
| `ok` が false | 書かない。`error` をユーザーに伝える |
| `duplicate` がある | 書かない。既存の `title` を伝える |
| `mappingRead` が false | `src/mapping.json` を自分で検索し、同じ URL があれば書かない |
| `needsReview` が true、または `title` が null | 書かない。`titles` と `candidates` を見せて料理名を聞く |
| それ以外 | `title` を料理名にして末尾に足す |

ユーザーが料理名を書いているときは、ページの名前よりそれを使う。`needsReview` では止まらない。重複の確認はする。

`source` が `og:title` または `title` のときは、JSON-LD のレシピ名が無い。スクリプトが `needsReview` を true にするので、料理名を確認してから書く。

スクリプトがページを開けないときは、ブラウザでその URL を開き、見えている料理名の見出しを読む。見出しも無いときは推測で書かない。

## 書く URL

`storeUrl` を書く。追跡用クエリ（`utm_*`、`srsltid`、`fbclid`、`gclid`）とフラグメントは除いてある。レシピを特定するクエリ（`CODE` など）は残る。

`finalUrl` がログイン画面や同意画面など、レシピ以外なら足さない。

重複は、`http` と `https`、末尾の `/`、上の追跡クエリの差を無視して判断する。スクリプトの `duplicate` がその判定である。

## title と kana

`title` はスクリプトが返した文字列を、さらに短くしない。サイト名、`by 投稿者`、「作り方」「レシピ」、`！` や `♪` の前の宣伝、`【料理名】宣伝` の外側は、スクリプトが外してある。

材料や調理法は残る。たとえば「ひき肉のれんこんはさみ焼き」から「ひき肉」は落とさない。「基本の豚のしょうが焼き」は「豚のしょうが焼き」になる。

`kana` は `title` のひらがな読み。カタカナはひらがなにし、外来語の長音は「ー」。空白は入れない。促音と拗音は小さい字にする。

| title | kana |
| --- | --- |
| 豚のしょうが焼き | ぶたのしょうがやき |
| 肉じゃが | にくじゃが |
| ロールキャベツ | ろーるきゃべつ |
| クリームスープ | くりーむすーぷ |
| 肉詰め | にくづめ |

読みが一つに決まらないときは、ファイルを変える前にユーザーへ確認する。

## 追記

既存の要素は並べ替えない。中身も変えない。配列の末尾にだけ足す。キーの順は次のとおり。

```json
{
  "title": "豚のしょうが焼き",
  "kana": "ぶたのしょうがやき",
  "url": "https://example.com/recipe/1",
  "addedDate": "YYYY-MM-DD",
  "memo": ""
}
```

`addedDate` は追加する日を Asia/Tokyo の `YYYY-MM-DD` で入れる。

```bash
TZ=Asia/Tokyo date +%F
```

`memo` は、ユーザーがメモを書いていないときは `""`。

## 検証

`node scripts/check-mapping.json.js` を実行する。失敗したら直してから終える。画面は変えないので、`vp test` と Playwright は走らせない。

終わったら、足した `title`、`kana`、`url` を伝える。足さなかった URL は、その理由も伝える。

## スクリプトを直したとき

```bash
node --test .agents/skills/add-recipe-from-url/scripts/extract-recipe-title.test.mjs
```
