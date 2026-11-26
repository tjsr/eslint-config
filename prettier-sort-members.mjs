import { createRequire } from 'node:module';

import config from './prettier.mjs';

const require = createRequire(import.meta.url);

export default {
  ...config,
  plugins: [require.resolve('prettier-plugin-sort-members')],
  sortMembersAlphabetically: true,
};
