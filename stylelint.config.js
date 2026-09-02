/** @type {import("stylelint").Config} */
export default {
  extends: ["stylelint-config-standard"],
  ignoreFiles: ["dist/**", "node_modules/**", "generated/**"],
  rules: {
    "at-rule-no-unknown": [
      true,
      { ignoreAtRules: ["mixin", "include", "value"] },
    ],
    // postcss-simple-vars: $mantine-breakpoint-*
    "media-query-no-invalid": null,
  },
  overrides: [
    {
      files: ["**/*.module.css"],
      extends: [
        "stylelint-config-css-modules",
        "@css-modules-kit/stylelint-plugin/recommended",
      ],
      rules: {
        // camelCase for local classes; kebab-case for :global(.mantine-*)
        "selector-class-pattern": [
          "^[a-z][a-zA-Z0-9]*$|^[a-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+$",
          {
            resolveNestedSelectors: true,
            message:
              "Expected class selector to be camelCase, or kebab-case for :global() targets",
          },
        ],
      },
    },
  ],
};
