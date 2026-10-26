import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const example = fileURLToPath(new URL('../examples/', import.meta.url));
const bin = fileURLToPath(new URL('../bin/i18n-diff.js', import.meta.url));

test('example translator workflow matches documented output and has an additions-only diff', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'i18n-example-'));
  try {
    cpSync(example, tmp, { recursive: true });
    const readme = readFileSync(join(tmp, 'README.md'), 'utf8');
    const cli = (args) => {
      const result = spawnSync(process.execPath, [bin, ...args], { cwd: tmp, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.error?.message);
      assert.ok(readme.includes(`\n${result.stdout.trimEnd()}\n`), `README must contain real output: ${result.stdout}`);
      return result;
    };
    const before = readFileSync(join(tmp, 'locales/fr.json'), 'utf8');
    cli(['export-missing', 'locales/en.json', 'locales/fr.json', '-o', 'todo-fr.json']);
    assert.deepEqual(JSON.parse(readFileSync(join(tmp, 'todo-fr.json'), 'utf8')), {
      greeting: 'Hello, {name}!', hint: 'Choose a <b>seed</b>.',
    });
    writeFileSync(join(tmp, 'todo-fr.json'), readFileSync(join(tmp, 'filled-fr.json')));
    cli(['merge', 'locales/fr.json', 'todo-fr.json', '--source', 'locales/en.json']);
    cli(['check', 'locales/en.json', 'locales/fr.json']);
    cli(['stats', 'locales/en.json', 'locales/fr.json', 'locales/de.json', 'locales/ru.json', '--format', 'markdown', '--sort', 'completion']);
    const after = readFileSync(join(tmp, 'locales/fr.json'), 'utf8');
    // This comparison also verifies byte-minimality when git is unavailable.
    const originalLines = before.split('\n');
    let index = 0;
    for (const line of after.split('\n')) if (line === originalLines[index]) index++;
    assert.equal(index, originalLines.length);
    assert.equal(after.split('\n').length - originalLines.length, 2);
    const baseline = join(tmp, 'before.json');
    writeFileSync(baseline, before);
    const git = spawnSync('git', ['--version']);
    if (git.status === 0) {
      const diff = spawnSync('git', ['diff', '--no-index', '--numstat', '--', baseline, join(tmp, 'locales/fr.json')], { encoding: 'utf8' });
      assert.equal(diff.status, 1, diff.stderr);
      assert.match(diff.stdout, /^2\s+0\s+/);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('example programmatic API runs successfully and matches expected output', () => {
  const result = spawnSync(process.execPath, [join(example, 'api.mjs')], {
    cwd: example,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /Completion: 71\.4%/);
  assert.match(result.stdout, /Issues found: 2/);
  assert.match(result.stdout, /Exported 2 missing keys/);
  assert.match(result.stdout, /Merge summary: added 2, filled 0/);
});

test('Turkish examples README matches English structure and documented commands', () => {
  const en = readFileSync(join(example, 'README.md'), 'utf8');
  const tr = readFileSync(join(example, 'README.tr.md'), 'utf8');
  const getHeadings = (text) => text.split('\n').filter((line) => line.startsWith('#')).map((line) => line.match(/^#+/)[0].length);
  assert.deepEqual(getHeadings(tr), getHeadings(en));
  assert.ok(en.includes('[Türkçe](README.tr.md)'));
  assert.ok(tr.includes('[English](README.md)'));
});
