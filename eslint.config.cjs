/* eslint-disable node/no-unsupported-features/es-syntax */
// Clean flat-config for ESLint v9+ using installed plugins/parsers.
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');

module.exports = {
  files: ['**/*.{js,jsx,ts,tsx}'],
  ignores: ['.next/**', 'node_modules/**', 'out/**'],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      // Enable type-aware linting now that @typescript-eslint and TS versions
      // are aligned via package.json changes.
      project: './tsconfig.json',
      tsconfigRootDir: __dirname,
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: { jsx: true },
    },
  },
  plugins: {
    '@typescript-eslint': tsPlugin,
    react: reactPlugin,
    'react-hooks': reactHooksPlugin,
  },
  rules: {
  'react-hooks/rules-of-hooks': 'warn',
  // re-enable exhaustive-deps for compatibility testing. If this crashes,
  // we will iterate plugin versions and @typescript-eslint to find a safe combo.
  'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-var-requires': 'off',
  },
  settings: {
    react: { version: 'detect' },
  },
};
