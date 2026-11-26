import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Keep import sorting opt-in; it can reorder side-effectful imports.
export default {
  importOrder: ['^react$', '^react-dom$', '^@?\\w', '^[./]'],
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  plugins: [require.resolve('@trivago/prettier-plugin-sort-imports')],
};
