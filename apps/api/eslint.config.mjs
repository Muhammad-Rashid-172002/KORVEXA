import base from '@glasswork/config/eslint';

export default [
  ...base,
  {
    // Nest DI needs runtime imports for constructor types; let the type-import rule know about decorator metadata.
    languageOptions: { parserOptions: { emitDecoratorMetadata: true, experimentalDecorators: true } },
  },
];
