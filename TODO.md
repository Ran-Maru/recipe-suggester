# TODO.md

## vp migrate

### ESLintから移行できなかったルールの警告

```txt
! Warnings:
  - Stripped JS plugin reference(s) from the generated lint config: @stylistic/eslint-plugin, @stylistic/eslint-plugin-js, @stylistic/eslint-plugin-ts, eslint-plugin-babel, @babel/eslint-plugin, @stylistic/eslint-plugin-jsx, eslint-plugin-flowtype, eslint-plugin-standard. No matching package is present in this workspace, so loading them at lint time would fail. If you want their Oxlint coverage back, install each package (e.g. `vp install <name>`) and add its name back to `lint.jsPlugins` in vite.config.ts.
```

### その他のTODO

- pluginの// @ts-expect-error
