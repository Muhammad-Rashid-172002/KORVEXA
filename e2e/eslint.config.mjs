import base from '@glasswork/config/eslint';

// scripts/ are standalone Node tools (Lighthouse, screenshots) that legitimately use console and process.
export default [...base, { ignores: ['scripts/**'] }];
