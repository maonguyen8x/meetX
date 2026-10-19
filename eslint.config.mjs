import nextPlugin from '@next/eslint-plugin-next';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/.next/**', '**/dist/**', '**/coverage/**', '**/node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    plugins: { '@next/next': nextPlugin },
    rules: nextPlugin.configs.recommended.rules,
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  eslintConfigPrettier,
);
