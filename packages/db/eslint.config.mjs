import base from '@glasswork/config/eslint';

// The db package is the one place allowed to import drizzle-orm directly.
export default [...base, { rules: { 'no-restricted-imports': 'off' } }];
