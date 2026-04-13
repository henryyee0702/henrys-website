import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  // Global ignores
  { ignores: ['dist/', 'references/', '.astro/', 'test-results/', '.artifacts/'] },

  // Base JS/TS rules — errors only, no style nits
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Astro files
  ...astro.configs.recommended,

  // Project-specific overrides
  {
    rules: {
      // Allow explicit any sparingly — tighten later
      '@typescript-eslint/no-explicit-any': 'warn',
      // Unused vars: error for vars, ignore args starting with _
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      // Astro env.d.ts uses triple-slash references by convention
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },

  // CJS config files (tailwind.config.cjs)
  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: { module: 'readonly', require: 'readonly' },
    },
  },

  // Node config files (astro.config.mjs, etc.)
  {
    files: ['astro.config.mjs'],
    languageOptions: {
      globals: { process: 'readonly' },
    },
  },
];
