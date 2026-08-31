/** @type {import("stylelint").Config} */
export default {
  extends: ["stylelint-config-standard"],
  ignoreFiles: ["dist/**", "node_modules/**", "generated/**"],
  rules: {
    "at-rule-no-unknown": [true, { ignoreAtRules: ["mixin", "include"] }],
  },
  overrides: [
    {
      files: ["**/*.module.css"],
      extends: [
        "stylelint-config-css-modules",
        "@css-modules-kit/stylelint-plugin/recommended",
      ],
    },
  ],
};
