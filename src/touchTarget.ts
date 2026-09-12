/**
 * Mobile-first tap-target and icon sizes.
 * See `.cursor/skills/mobile-touch-targets/SKILL.md`.
 */

/** Apple HIG / WCAG 2.5.5 minimum control size, in CSS pixels. */
export const MIN_TOUCH_TARGET_PX = 44;

/**
 * Phosphor icon edge length inside a 44px-or-larger control.
 * The glyph stays smaller than the tap target so the hit area stays generous.
 */
export const TOUCH_ICON_PX = 24;

/** Mantine ActionIcon size whose box is 44px. */
export const TOUCH_ACTION_ICON_SIZE = "xl";

/** Mantine Input / TextInput size whose height is 50px (>= 44). */
export const TOUCH_INPUT_SIZE = "lg";

/** ActionIcon size that fills a `lg` TextInput section (50px). */
export const TOUCH_INPUT_ACTION_ICON_SIZE = "input-lg";

/** Mantine Button size whose height is 50px. */
export const TOUCH_BUTTON_SIZE = "lg";
