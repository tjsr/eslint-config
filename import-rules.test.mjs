import assert from 'node:assert/strict';
import test from 'node:test';

import { ESLint } from 'eslint';

import config from './index.mjs';

const eslint = new ESLint({ overrideConfig: config, overrideConfigFile: true });

/** Lint a TypeScript consumer with the complete shared configuration. */
async function lint(source) {
  const [result] = await eslint.lintText(source, { filePath: 'consumer.ts' });
  assert.equal(result.fatalErrorCount, 0);
  return result;
}

test('accepts correctly grouped and ordered imports on ESLint 10', async () => {
  const result = await lint("import path from 'node:path';\n\nexport const separator = path.sep;\n");
  assert.deepEqual(result.messages, []);
});

test('enforces import ordering and fixes it without a removed SourceCode API', async () => {
  const source = "import path from 'node:path';\nimport fs from 'node:fs';\n\nexport const values = [path, fs];\n";
  const result = await lint(source);
  assert.ok(result.messages.some((message) => message.ruleId === 'import/order'));
  const fixer = new ESLint({ fix: true, overrideConfig: config, overrideConfigFile: true });
  const [fixed] = await fixer.lintText(source, { filePath: 'consumer.ts' });
  assert.equal(fixed.errorCount, 0);
  assert.ok(fixed.output.indexOf("'node:fs'") < fixed.output.indexOf("'node:path'"));
});

test('keeps explicit TypeScript relative extensions required', async () => {
  const result = await lint("import value from './fixture';\n\nexport { value };\n");
  assert.ok(result.messages.some((message) => message.ruleId === 'import/extensions'));
  const valid = await lint("import value from './fixture.ts';\n\nexport { value };\n");
  assert.equal(valid.messages.filter((message) => message.ruleId === 'import/extensions').length, 0);
});
