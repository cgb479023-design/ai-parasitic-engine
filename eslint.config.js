import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";

export default [
  // Global ignores for files not meant to be linted at all
  {
    ignores: ["dist/**", "gemini-extension/dist/**", "server/**", "tests/**", "**/__tests__/**", "vite.config.ts", "vitest.config.ts", "vitest.setup.ts"],
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },

  // 1. Recommended JavaScript rules for all JS/JSX files
  pluginJs.configs.recommended,

  // 2. Base React/JS/JSX Configuration (no TS type-aware linting here)
  {
    files: ["**/*.{js,jsx}"],
    plugins: {
      react: pluginReact,
      "react-hooks": eslintPluginReactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        process: "readonly",
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      ...pluginReact.configs.recommended.rules,
      ...eslintPluginReactHooks.configs.recommended.rules,
      "no-undef": "off",
      "no-empty": "off",
      "no-useless-escape": "off",
      "no-misleading-character-class": "off",
      "no-fallthrough": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },

  // 3. TypeScript & React Configuration (TS/TSX files with type-checking)
  {
    files: ["**/*.{ts,tsx}"], // Target TypeScript files
    plugins: {
      "@typescript-eslint": tseslint.plugin, // Explicitly declare the TypeScript plugin
      react: pluginReact,
      "react-hooks": eslintPluginReactHooks,
    },
    languageOptions: {
      parser: tseslint.parser, // Specify the TypeScript parser
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        process: "readonly",
        chrome: "readonly", // Add chrome for extension APIs
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // Spread recommended TypeScript type-checked rules
      ...tseslint.configs.recommended.rules,
      // Spread recommended React rules
      ...pluginReact.configs.recommended.rules,
      ...eslintPluginReactHooks.configs.recommended.rules,
      // Custom overrides for TypeScript rules
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unused-expressions": "error", // Make unused expressions an error
      "@typescript-eslint/restrict-template-expressions": "off",
      "react/react-in-jsx-scope": "off", // New JSX transform
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-empty": "off",
      "no-useless-escape": "off",
      "no-misleading-character-class": "off",
      "no-fallthrough": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },

  // 4. Overrides for browser extension specific JavaScript files (no TypeScript type checking)
  {
    files: ["gemini-extension/**/*.js"],
    // No specific parser for these files; let it be inferred as JS.
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        chrome: "readonly",
        self: "readonly", // For service workers
        importScripts: "readonly", // For background scripts
      },
    },
    rules: {
      // Relax rules that might be problematic in raw JS extension files
      "no-undef": "off", // Assume globals are managed by browser/extension APIs
      "no-empty": "warn",
      "no-cond-assign": "warn",
      "no-useless-escape": "warn",
      "no-prototype-builtins": "warn",
      "valid-typeof": "warn",
      "no-misleading-character-class": "off",
    }
  },
];
