// Shared ESLint flat config for every workspace package.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/** Brand strings must only live in packages/shared/src/brand.ts (DECISIONS D-001). */
const brandLiteralRule = {
  'no-restricted-syntax': [
    'error',
    {
      selector: 'Literal[value=/Glasswork|KorvenzaTech|Korvenza Hub/]',
      message: 'Brand names live only in packages/shared/src/brand.ts — import `brand` instead.',
    },
    {
      selector: 'TemplateElement[value.raw=/Glasswork|KorvenzaTech|Korvenza Hub/]',
      message: 'Brand names live only in packages/shared/src/brand.ts — import `brand` instead.',
    },
    {
      selector: 'JSXText[value=/Glasswork|KorvenzaTech|Korvenza Hub/]',
      message: 'Brand names live only in packages/shared/src/brand.ts — import `brand` instead.',
    },
  ],
};

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/coverage/**', '**/*.d.ts', '**/migrations/**', '**/next-env.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      ...brandLiteralRule,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/brand.ts', '**/*.test.ts', '**/*.spec.ts', '**/test/**', '**/e2e/**', '**/seed/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
