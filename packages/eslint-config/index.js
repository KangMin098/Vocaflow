// packages/eslint-config/index.js
// 공통 ESLint 규칙. 각 앱은 .eslintrc.json 의 "extends" 에 "@vocaflow/eslint-config" 추가.
module.exports = {
  root: false,
  env: { browser: true, node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['dist', '.next', '.turbo', 'node_modules'],
};
