// Flat ESLint config (CommonJS) using Next.js core-web-vitals preset
// This file is compatible with ESLint v9+ and Next.js lint command
/* eslint-disable node/no-unsupported-features/es-syntax */
const nextCore = require('eslint-config-next/core-web-vitals');

module.exports = [
  // include Next's recommended flat config
  nextCore,
  // Project specific additions
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**'],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      // Add any project overrides here; keep defaults from Next
    },
  },
];
