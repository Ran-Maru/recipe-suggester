# 概要

美味しかったレシピのURLをまとめたサイト
https://ran-maru.github.io/recipe-suggester/

## 機能

- 一覧からランダムにレシピを選ぶ機能
- レシピ一覧を見る機能

## 見た目の比較

PR を出すと、GitHub Actions の Visual Regression が変更前と変更後の画面を Playwright で撮って比べます。画像はリポジトリにコミットせず、Actions の artifact に置きます。比較結果は GitHub Pages に出て、URL が PR のコメントに付きます。

レポートと artifact は 14 日で消えます。消えたあとに見たいときは、Actions の Visual Regression を手動実行し、PR 番号を入れてください。マージ済みの PR でも、そのマージコミットとマージ直前を比べます。
