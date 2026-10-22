import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLocaleText } from '../src/files.js';
import { JsonSyntaxError, LineIndex, parseJson } from '../src/json-ast.js';

test('parses every JSON value type with offsets', () => {
  const text = '{"a": [1, -2.5e3, true, false, null], "b": {"c": "d\\n"}}';
  const root = parseJson(text);
  assert.equal(root.type, 'object');
  const a = root.members[0].value;
  assert.deepEqual(a.items.map((item) => item.value), [1, -2500, true, false, null]);
  const c = root.members[1].value.members[0].value;
  assert.equal(c.value, 'd\n');
  assert.equal(text.slice(c.start, c.end), '"d\\n"');
  assert.equal(text.slice(root.members[0].keyStart, root.members[0].keyEnd), '"a"');
});

test('agrees with JSON.parse on a realistic document', () => {
  const doc = { a: { b: ['x', { c: 1 }], d: null }, e: 'café ☃ 😀', f: 1e21 };
  const text = JSON.stringify(doc, null, 2);
  const flat = parseLocaleText(text);
  assert.ok(flat.entries.has('a.b.0'));
  assert.ok(flat.entries.has('a.b.1.c'));
  assert.equal(flat.entries.get('e').value, doc.e);
  assert.equal(flat.entries.get('a.d').value, null);
});

test('accepts a leading byte order mark', () => {
  assert.equal(parseJson('﻿{"a": "b"}').members[0].key, 'a');
});

test('rejects invalid documents with a position', () => {
  const cases = [
    ['{"a": 1,}', /Trailing commas are not supported in JSON files at line 1, column 8/],
    ['{"a" 1}', /Expected ':'/],
    ['{"a": 1', /Expected ',' or '}'/],
    ['{"a": "x', /Unterminated string/],
    ['{"a": "\\q"}', /Invalid escape/],
    ['{"a": tru}', /Unexpected character/],
    ['{"a": 01}', /Expected ',' or '}'/],
    ['{} x', /Unexpected data after JSON value/],
    ['', /Unexpected end of input/],
    ['{"a": "line\nbreak"}', /Control character/],
  ];
  for (const [text, pattern] of cases) {
    assert.throws(() => parseJson(text), (error) => error instanceof JsonSyntaxError && pattern.test(error.message), text);
  }
});

test('reports the line of a syntax error', () => {
  assert.throws(() => parseJson('{\n  "a": 1,\n  "b": }\n'), /line 3, column 8/);
});

test('top-level value must be an object for locale files', () => {
  assert.throws(() => parseLocaleText('["a"]', 'x.json'), /top-level JSON value must be an object/);
});

test('LineIndex maps offsets to 1-based positions', () => {
  const index = new LineIndex('ab\ncd\n\nef');
  assert.deepEqual(index.at(0), { line: 1, column: 1 });
  assert.deepEqual(index.at(3), { line: 2, column: 1 });
  assert.deepEqual(index.at(4), { line: 2, column: 2 });
  assert.deepEqual(index.at(7), { line: 4, column: 1 });
});

test('deep nesting is rejected instead of overflowing the stack', () => {
  assert.throws(() => parseJson(`${'['.repeat(2000)}${']'.repeat(2000)}`), /Nesting too deep/);
});
