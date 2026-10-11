import base from '@glasswork/config/eslint';
import nextPlugin from '@next/eslint-plugin-next';

export default [
  { ignores: ['public/sw.js'] }, // service worker: plain JS with worker globals, not app code
  ...base,
  {
    plugins: { '@next/next': nextPlugin },
    rules: { ...nextPlugin.configs.recommended.rules, ...nextPlugin.configs['core-web-vitals'].rules },
  },
];
