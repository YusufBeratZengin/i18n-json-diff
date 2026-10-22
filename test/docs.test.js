import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { run } from '../src/cli.js';

const readme = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
function headings(text) {
  let fenced = false;
  const levels = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced;
    else if (!fenced && /^#+ /.test(line)) levels.push(line.match(/^#+/)[0].length);
  }
  assert.equal(fenced, false, 'all code fences must be closed');
  return levels;
}

test('English and Turkish READMEs have the same heading structure and real demo output', () => {
  const en = readme('README.md');
  const tr = readme('README.tr.md');
  assert.deepEqual(headings(tr), headings(en));
  assert.ok(en.includes('[Türkçe](README.tr.md)'));
  assert.doesNotMatch(en + tr, /Turkce/);
  for (const args of [
    ['check', 'test/fixtures/en.json', 'test/fixtures/fr.json'],
    ['stats', 'test/fixtures/en.json', 'test/fixtures/fr.json', 'test/fixtures/ru.json'],
  ]) {
    let stdout = '';
    const code = run(args, { stdout: (s) => { stdout += s; }, stderr: () => {} });
    assert.equal(code, args[0] === 'check' ? 1 : 0);
    for (const text of [en, tr]) assert.ok(text.includes(`\n${stdout.trimEnd()}\n`));
  }
});
