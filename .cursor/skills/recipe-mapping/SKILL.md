---
name: recipe-mapping
description: >-
  Adds or updates recipe entries in src/mapping.json for recipe-suggester.
  Use when adding recipes, editing mapping.json, validating recipe data, or
  when the user mentions レシピ追加, mapping, or recipe URLs.
---

# Recipe mapping

`recipe-suggester` picks a random recipe from `src/mapping.json`. There is no backend; this file is the only recipe data source.

## Schema

`src/mapping.json` is a JSON array. Each entry must be an object with:

| Field   | Type   | Rules                                            |
| ------- | ------ | ------------------------------------------------ |
| `title` | string | Non-empty after trim (menu name shown in the UI) |
| `url`   | string | Non-empty after trim (recipe page URL)           |

Example:

```json
{
  "title": "しょうが焼き",
  "url": "https://park.ajinomoto.co.jp/recipe/card/706344/"
}
```

## Validation

`scripts/check-mapping.json.js` runs as part of `vp run check` and verifies:

1. Valid JSON syntax
2. Root value is an array
3. Every item is a non-null object
4. Every item has non-empty string `title` and `url`

On failure it prints index-specific errors and exits with code 1.

## Workflow

1. Edit `src/mapping.json` — append or update entries; keep valid JSON (trailing commas are invalid).
2. Run `vp run check` to lint, typecheck, and validate the mapping.
3. If UI behavior changed, run E2E tests (see the `playwright-e2e` skill).

## Notes

- URLs may be external `https://` links or same-origin paths used by in-app recipes.
- The `/recipes` list page reads the same file; new entries appear there automatically after build.
