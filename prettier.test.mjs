import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { test } from 'node:test';
import { URL, fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('./prettier-cli.mjs', import.meta.url));
const format = (config, input) =>
  execFileSync(process.execPath, [cli, '--config', config, '--stdin-filepath', 'example.ts'], {
    encoding: 'utf8',
    input,
  });

test('base formatting does not sort imports or type members', () => {
  const source = "import z from 'z';\nimport a from 'a';\ninterface Example { z: string; a: string }";
  const result = format('prettier.mjs', source);
  assert.match(result, /import z[^\n]+\nimport a/u);
  assert.match(result, /z: string;\s+a: string;/u);
});

test('the member sorter is loaded from the shared config', () => {
  const result = format('prettier-sort-members.mjs', 'interface Example { z: string; a: string }');
  assert.match(result, /a: string;\s+z: string;/u);
});
