# 概要

美味しかったレシピのURLをまとめたサイト
https://ran-maru.github.io/recipe-suggester/

## 機能

- 一覧からランダムにレシピを選ぶ機能
- レシピ一覧を見る機能

## 見た目の比較（VRT）

PR ごとに、変更前と変更後の画面を Playwright の `toHaveScreenshot` で比べ、その結果を Cloudflare Workers（R2）に載せる。PR のコメントのリンクから、ダウンロードなしで HTML レポートを開ける。

- 変更前は PR の分岐点（base と head の merge-base）、変更後は PR の head。両方をその場でビルドして撮るので、画像はリポジトリに置かない
- 画素が 1 つでも違えば失敗する。PR のマージは止めない
- レポートは 14 日で消える。PR がマージされたときも消す
- 消えたあとに見たいときは、Actions の「Visual Regression」を手動実行し、PR 番号を入れる。SHA から両方を作り直す
- fork と Dependabot の PR はシークレットが渡らないので、レポートは載せない（Actions の artifact `vrt-report` からは取れる）

### 最初の設定（1 回だけ）

1. Cloudflare で R2 バケット `recipe-suggester-vrt` を作る
2. GitHub のシークレットに `CLOUDFLARE_API_TOKEN`（Workers と R2 の編集権限）、`CLOUDFLARE_ACCOUNT_ID`、`VRT_UPLOAD_TOKEN`（アップロード用の合言葉。長いランダム文字列）を入れる
3. `workers/vrt/` を main に入れる（または「Visual Regression Worker Deploy」を手動実行する）。Worker が `*.workers.dev` に出る
4. 出た URL を GitHub の変数 `VRT_WORKER_URL` に入れる（例: `https://recipe-suggester-vrt.<アカウント>.workers.dev`）

シークレットか変数が無いときは、Cloudflare への掲載を飛ばし、artifact だけにする。

### ローカルで試す

```bash
# 変更前の画面を基準画像にする（要: 変更前の dist を vp preview できるディレクトリ）
VRT_MODE=update VRT_PREVIEW_CWD=<変更前のディレクトリ> VRT_OUT_DIR=vrt-output bash scripts/vrt/run-playwright.sh
# 変更後の画面を比べる。レポートは vrt-output/report
VRT_MODE=compare VRT_PREVIEW_CWD=<変更後のディレクトリ> VRT_OUT_DIR=vrt-output bash scripts/vrt/run-playwright.sh
```
