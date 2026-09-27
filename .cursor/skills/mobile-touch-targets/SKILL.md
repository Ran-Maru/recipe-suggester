---
name: mobile-touch-targets
description: >-
  Mobile tap-target and icon sizing for recipe-suggester. Use when changing
  buttons, ActionIcons, Phosphor icon size, the recipes search field
  (アドレスバー相当), or when the user mentions スマホ, タップ, タッチターゲット,
  アイコンサイズ, or アドレスバー.
---

# スマホのタップ領域とアイコンサイズ

このアプリはスマホでの利用が先。ブラウザテストはすでに 390×844 のビューポートを使っている。
**操作対象**（タップ領域）と **字形**（Phosphor アイコン）は別々にサイズを決める。

共通の値は `src/touchTarget.ts` にある。`16` / `18` や Mantine の既定 `sm` / `md` を直書きせず、そこの定数を import する。

Mantine の `ActionIcon` / `Button` / `Input` の既定サイズはデスクトップ向けなので、既定のままスマホで使わない。

## ルール

1. **タップ領域は 44×44 CSS px 以上。** Apple HIG と WCAG 2.5.5 に合わせる。WCAG 2.5.8（24px）は下限であり、目標ではない。
2. **アイコンの字形は 24px。** 16 でも 18 でもない。Phosphor 自身の既定も 24。字形はボタンより小さく保ち、余白をタップできるようにする。
3. **単独のアイコンボタン**は Mantine `ActionIcon` の `size="xl"`（44px）に `TOUCH_ICON_PX`（24）を足す。
4. **検索欄（アドレスバー相当）**は `TextInput` の `size="lg"`（50px）。input（`searchInput`）の `font-size` は `rem(16)` のままにし、iOS がフォーカス時にズームしないようにする。クリアの `ActionIcon` は `size="input-lg"` にし、欄の高さいっぱいにする。
5. **テキストボタン**は `Button` の `size="lg"`（50px）。`/` の副アクションも含む。
6. 隣り合うアイコンボタン（開く + コピー）は、44px の領域が重ならない列幅を取る。アイコン列あたりおよそ `rem(80)`。

## 対応表

| 役割                | Mantine の `size`                            | ボックス  | Phosphor の `size`    |
| ------------------- | -------------------------------------------- | --------- | --------------------- |
| 一覧の開く / コピー | `TOUCH_ACTION_ICON_SIZE`（`xl`）             | 44px      | `TOUCH_ICON_PX`（24） |
| 検索欄              | `TOUCH_INPUT_SIZE`（`lg`）                   | 高さ 50px | —                     |
| 検索のクリア        | `TOUCH_INPUT_ACTION_ICON_SIZE`（`input-lg`） | 50px      | `TOUCH_ICON_PX`（24） |
| ホームのボタン      | `TOUCH_BUTTON_SIZE`（`lg`）                  | 高さ 50px | —                     |

## やってはいけないこと

- タップできる UI に Phosphor の `size={16}` や `size={18}` を使わない。
- 28px の `ActionIcon` の中の SVG だけを大きくしない。はみ出すか切れる。当たり判定は小さいままだ。
- 検索欄を `md`（42px）より小さくしない。`lg` を使う。
- タップ領域を大きく見せるために Mantine の `style` / `styles` prop を使わない。`size` prop と CSS Modules を使う（`AGENTS.md` と同じ）。

## 新しいアイコンボタンを足すとき

```tsx
import { Copy } from "@phosphor-icons/react";
import { ActionIcon } from "@mantine/core";
import { TOUCH_ACTION_ICON_SIZE, TOUCH_ICON_PX } from "../touchTarget.ts";

<ActionIcon size={TOUCH_ACTION_ICON_SIZE} aria-label="URLをコピー">
  <Copy size={TOUCH_ICON_PX} aria-hidden="true" />
</ActionIcon>;
```
