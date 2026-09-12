---
name: mobile-touch-targets
description: >-
  Mobile tap-target and icon sizing for recipe-suggester. Use when changing
  buttons, ActionIcons, Phosphor icon size, the recipes search field
  (アドレスバー相当), or when the user mentions スマホ, タップ, タッチターゲット,
  アイコンサイズ, or アドレスバー.
---

# Mobile tap targets and icon size

This app is used on phones first. Browser tests already use a 390×844 viewport.
Size **the control** (tap target) and **the glyph** (Phosphor icon) separately.

Shared values live in `src/touchTarget.ts`. Import those constants instead of
hard-coding `16` / `18` or Mantine's default `sm` / `md`.

## Why the old sizes were too small

| Control                                | Previous  | Problem                                    |
| -------------------------------------- | --------- | ------------------------------------------ |
| `ActionIcon` (default `md`)            | 28×28px   | Below the 44px thumb target                |
| Phosphor icon in list actions          | 18px      | Hard to see; does not enlarge the hit area |
| Search clear icon                      | 16px      | Same                                       |
| Search `TextInput` (default `sm`)      | 36px tall | Below 44px; easy to miss on a phone        |
| Home secondary `Button` (default `sm`) | 36px tall | Same                                       |

Mantine's default `ActionIcon` / `Button` / `Input` sizes are desktop-oriented.
Do not assume the default is mobile-safe.

## Rules

1. **Tap target ≥ 44×44 CSS px.** Follow Apple HIG and WCAG 2.5.5. WCAG 2.5.8
   (24px) is the floor, not the goal.
2. **Icon glyph is 24px**, not 16 or 18. Phosphor's own default is 24. The
   glyph must stay smaller than the button so extra padding remains tappable.
3. **Standalone icon buttons** use Mantine `ActionIcon` `size="xl"` (44px) plus
   `TOUCH_ICON_PX` (24).
4. **Search / address-bar field** uses `TextInput` `size="lg"` (50px). Keep
   `font-size: rem(16)` on the input (`searchInput`) so iOS does not zoom on
   focus. The clear `ActionIcon` uses `size="input-lg"` so it fills the field
   height.
5. **Text buttons** use `Button` `size="lg"` (50px), including secondary
   actions on `/`.
6. Adjacent icon buttons (open + copy) need enough column width that the 44px
   targets do not overlap. Use about `rem(80)` per icon column.

## Mapping

| Role             | Mantine `size`                              | Box       | Phosphor `size`      |
| ---------------- | ------------------------------------------- | --------- | -------------------- |
| List open / copy | `TOUCH_ACTION_ICON_SIZE` (`xl`)             | 44px      | `TOUCH_ICON_PX` (24) |
| Search field     | `TOUCH_INPUT_SIZE` (`lg`)                   | 50px tall | —                    |
| Search clear     | `TOUCH_INPUT_ACTION_ICON_SIZE` (`input-lg`) | 50px      | `TOUCH_ICON_PX` (24) |
| Home buttons     | `TOUCH_BUTTON_SIZE` (`lg`)                  | 50px tall | —                    |

## Do not

- Use Phosphor `size={16}` or `size={18}` for tappable UI.
- Enlarge only the SVG inside a 28px `ActionIcon`. That overflows or clips;
  the hit area stays too small.
- Shrink the search field below `md` (42px). Prefer `lg`.
- Use Mantine `style` / `styles` props to fake a larger target. Use `size`
  props and CSS Modules as in `AGENTS.md`.

## When adding a new icon button

```tsx
import { Copy } from "@phosphor-icons/react";
import { ActionIcon } from "@mantine/core";
import { TOUCH_ACTION_ICON_SIZE, TOUCH_ICON_PX } from "../touchTarget.ts";

<ActionIcon size={TOUCH_ACTION_ICON_SIZE} aria-label="URLをコピー">
  <Copy size={TOUCH_ICON_PX} aria-hidden="true" />
</ActionIcon>;
```
