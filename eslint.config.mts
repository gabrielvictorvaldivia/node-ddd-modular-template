import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import noRelativeImportPaths from 'eslint-plugin-no-relative-import-paths';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js, noRelativeImportPaths },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.node },
  },
  tseslint.configs.recommended,
]);
