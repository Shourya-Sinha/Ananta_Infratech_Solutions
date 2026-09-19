module.exports = {
  root: true,
  parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
  plugins: ["react", "react-hooks"],
  extends: ["eslint:recommended", "plugin:react/recommended", "plugin:react-hooks/recommended"],
  env: { browser: true, es2022: true },
  settings: { react: { version: "detect" } },
  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
  },
  ignorePatterns: ["dist", "node_modules"],
};
