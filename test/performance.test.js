import assert from 'node:assert/strict';
import { test } from 'node:test';
import { benchmark } from '../scripts/bench.mjs';

test('20,000 keys check in under 3 s and merge changes only the 100 added lines', () => {
  const result = benchmark();
  assert.ok(result.checkMs < 3000, `check including parse took ${result.checkMs.toFixed(1)} ms`);
  assert.equal(result.checked.summary.expected, 20_000);
  assert.equal(result.checked.summary.missing, 100);
  assert.equal(result.merged.added.length, 100);
  assert.equal(result.merged.text, result.expectedText);
  const before = result.targetText.split('\n');
  const after = result.merged.text.split('\n');
  let index = 0;
  for (const line of after) if (line === before[index]) index++;
  assert.equal(index, before.length, 'every original line survives in order');
  assert.equal(after.length - before.length, 100);
});
