---
name: github-actions-scripts
description: >-
  Prefer TypeScript over shell for scripts that GitHub Actions runs in
  recipe-suggester. Use when adding or editing a workflow run step, a script
  under scripts/ called from .github/workflows, or when the user mentions
  GitHub Actions, CI scripts, シェル, or ワークフロー.
---

# GitHub Actions から呼ぶスクリプト

ワークフローの起動条件、権限、`needs`、`concurrency`、action の pin は YAML のままにする。そこから呼ぶ処理は TypeScript を優先する。分岐や入力の検証を `run: |` のシェルや `actions/github-script` に書かない。

カスタム JS アクションにして `dist` をコミットしない。このリポジトリのスクリプトは `noEmit` で、`node --experimental-strip-types` が入口だ。`tsx` と `ts-node` は足さない。

## TypeScript にする

条件分岐、日付や文字列の検証、終了コードの合成、`gh` や `git` の結果で進み方を変える手続きは `scripts/*.ts` にする。ワークフローからは次の1行で呼ぶ。

```yaml
run: node --experimental-strip-types scripts/example.ts
```

ステップの `env` に `NODE_NO_WARNINGS: "1"` を置く。

- Node がまだ無いジョブには、既存ワークフローと同じ pin の `actions/setup-node` と `node-version-file: ".node-version"` だけを足す。`vp` や依存パッケージが要るときだけ `voidzero-dev/setup-vp` を使う。action を足したら `gh actions-lock` で `.github/workflows/actions.lock` を更新する。手では書き換えない。拡張の pin は `.github/workflows/verify-lockfile.yml` にある。
- 新しい `scripts/*.ts` と `scripts/*.test.ts` は `tsconfig.node.json` の `include` に足す。一覧は明示なので、ファイルを置いただけでは型チェックに入らない。
- `tsconfig.node.json` は `erasableSyntaxOnly`。enum とパラメータプロパティは使わない。ローカルの import は `./example.ts` のように拡張子を付ける。
- テストは `scripts/<name>.test.ts` で、import は `vite-plus/test`。日付や文字列の判定は関数に切り出し、`vp test` で固定する。`gh` や `git` へ渡す引数は、PATH に偽物を置いた統合テストで見る。
- 判定の関数が既にあるときは、それを import して呼ぶ。標準出力の `key=value` を別プロセスが読み戻す形にはしない。
- ファイルを直接実行したときだけ `main` が走るようにする。形は `scripts/recipe-additions-only.ts` の `isDirectRun`。テストが import したときに本体が動くと、Vitest の中で `process.exit` する。
- `GITHUB_OUTPUT` に書く値へ改行を含めない。

いまの入口は `scripts/biweekly-gate.ts`、`scripts/playwright-ci.ts`、`scripts/merge-recipe-additions-pr.ts`、`scripts/vp-migrate-renovate.ts`。レシピ差分の判定そのものは `scripts/recipe-additions-only.ts`。Vite+ のピンの戻しは `scripts/vp-migrate-pins.ts`。

## シェルのままにする

コマンドを並べるだけで、分岐が無いものに限る。

- `curl`、`tar`、チェックサム、`install` でバイナリを置くもの。`scripts/install-ci-linters.sh`、`scripts/install-similarity-ts.sh`、`scripts/lint-shell-and-workflows.sh`。この処理は Node を入れずに終わらせる。
- 分岐の無い1コマンド。`cp dist/index.html dist/404.html`、`gh extension install`、`gh actions-lock --verify`。
- Node を入れていない短いジョブで、分岐が `gh` の数行に収まるもの。`ci.yml` の `dependency-auto-merge`（`hold` ラベル）は `ubuntu-slim` で `gh` だけを使う。
- Actions から呼ばないもの。`.cursor/hooks/`、`scripts/worktree-ports.sh`、`scripts/dangerous-command-policy.sh`、`.cursor/install.sh`。hook は bash のまま動かす。

同じ手順をシェルと TypeScript の両方に残さない。移したらシェルは削除する。

## 検査

残った `.sh` は ShellCheck、ワークフローは actionlint。入れ方は `scripts/lint-shell-and-workflows.sh` の先頭コメント。TypeScript 側は `vp test` と `vp check`。
