import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { run } from '../src/cli.js';
import { loadConfig } from '../src/config.js';
import { exportMissing } from '../src/export.js';
import { parseLocaleText } from '../src/files.js';
import { parseIcu } from '../src/icu.js';
import { parseJson } from '../src/json-ast.js';
import { normalizeLocale, pluralCategoriesFor } from '../src/locale.js';
import { mergeTranslations } from '../src/merge.js';

const tmp = mkdtempSync(path.join(tmpdir(), 'i18n-edge-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

test('config validation: bad json, non-object, and invalid field types', () => {
  const badJson = path.join(tmp, 'bad.json');
  writeFileSync(badJson, '{ invalid json');
  assert.throws(() => loadConfig(badJson, tmp), /Cannot read config/);

  const arrayConfig = path.join(tmp, 'array.json');
  writeFileSync(arrayConfig, '[]');
  assert.throws(() => loadConfig(arrayConfig, tmp), /must be a JSON object/);

  const stringConfig = path.join(tmp, 'string.json');
  writeFileSync(stringConfig, '"hello"');
  assert.throws(() => loadConfig(stringConfig, tmp), /must be a JSON object/);

  const notFoundConfig = path.join(tmp, 'missing.json');
  assert.throws(() => loadConfig(notFoundConfig, tmp), /Config file not found/);

  const listFieldInvalid = path.join(tmp, 'list.json');
  writeFileSync(listFieldInvalid, JSON.stringify({ allowKeys: [123] }));
  assert.throws(() => loadConfig(listFieldInvalid, tmp), /must be an array of strings/);

  const nonBoolWarnings = path.join(tmp, 'warn.json');
  writeFileSync(nonBoolWarnings, JSON.stringify({ warningsAsErrors: 'yes' }));
  assert.throws(() => loadConfig(nonBoolWarnings, tmp), /must be a boolean/);

  const nonStringSourceLocale = path.join(tmp, 'locale.json');
  writeFileSync(nonStringSourceLocale, JSON.stringify({ sourceLocale: 42 }));
  assert.throws(() => loadConfig(nonStringSourceLocale, tmp), /must be a string/);

  const invalidFormat = path.join(tmp, 'format.json');
  writeFileSync(invalidFormat, JSON.stringify({ format: 'xml' }));
  assert.throws(() => loadConfig(invalidFormat, tmp), /must be text, json, github or markdown/);
});

test('CLI glob in non-existent directory reports no files match', () => {
  let stderr = '';
  const code = run(
    ['check', 'test/fixtures/en.json', path.join(tmp, 'nonexistent-dir', '*.json')],
    { stdout: () => {}, stderr: (s) => { stderr += s; } },
    tmp
  );
  assert.equal(code, 2);
  assert.match(stderr, /No files match/);
});

test('JSON AST parses empty arrays and reports missing commas in arrays', () => {
  const emptyArr = parseJson('[]');
  assert.equal(emptyArr.type, 'array');
  assert.equal(emptyArr.items.length, 0);

  const nestedArr = parseJson('{"arr": []}');
  assert.equal(nestedArr.members[0].value.type, 'array');
  assert.equal(nestedArr.members[0].value.items.length, 0);

  assert.throws(() => parseJson('[1 2]'), /Expected ',' or ']'/);
});

test('export-missing handles nested key collisions gracefully', () => {
  // Source has nesting and colliding dotted keys
  const source = parseLocaleText('{"nested": {"x": "ok"}, "a": "first", "a.b": "second"}', 'en.json');
  const target = parseLocaleText('{}', 'fr.json');
  const exported = exportMissing(source, target);
  assert.equal(exported.count, 3);
  assert.equal(exported.data.a, 'first');
  assert.equal(exported.data['a.b'], 'second');
});

test('ICU tokenizer handles quoted strings with escapes, unclosed quotes, and unclosed options', () => {
  const unclosedQuote = parseIcu("'{'unclosed");
  assert.equal(unclosedQuote.error, null);

  const doubleQuoteInEscape = parseIcu("'{'it''s quoted'}'");
  assert.equal(doubleQuoteInEscape.error, null);

  const unclosedOptions = parseIcu('{count, plural, one {text');
  assert.equal(unclosedOptions.error, "Unclosed '{'");

  const unclosedStyle = parseIcu('{val, date, style');
  assert.equal(unclosedStyle.error, "Unclosed '{'");

  const unclosedQuoteInStyle = parseIcu("{val, date, '{' unclosed");
  assert.equal(unclosedQuoteInStyle.error, "Unclosed '{'");

  const escapedQuoteInStyle = parseIcu("{val, date, '{it''s}'}");
  assert.equal(escapedQuoteInStyle.error, null);
});

test('locale normalization and plural categories fallback on unsupported or invalid inputs', () => {
  assert.equal(normalizeLocale(''), null);
  assert.equal(normalizeLocale(123), null);
  assert.equal(normalizeLocale('not-a-locale-too-long-long-subtag'), null);
  assert.equal(normalizeLocale('en-us-extra-invalid-tag'), null);
  assert.equal(pluralCategoriesFor(null), null);
  assert.equal(pluralCategoriesFor(''), null);
  assert.equal(pluralCategoriesFor('xyz-unsupported-tag'), null);
});

test('merge formats inserted nested objects into compact single-line targets', () => {
  const target = parseLocaleText('{"a": "1"}', 'target.json');
  const filled = parseLocaleText('{"b": {"c": "2"}}', 'filled.json');
  const merged = mergeTranslations(target, filled);
  assert.equal(merged.added.length, 1);
  assert.match(merged.text, /{"a": "1", "b": {"c": "2"}}/);
});
