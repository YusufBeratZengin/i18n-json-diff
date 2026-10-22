import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLocaleText } from '../src/files.js';
import { mergeTranslations } from '../src/merge.js';

/** Line-based diff via longest common subsequence: what a git diff would show. */
function lineDiff(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  const table = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const removed = [];
  const added = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) removed.push(a[i++]);
    else added.push(b[j++]);
  }
  removed.push(...a.slice(i));
  added.push(...b.slice(j));
  return { removed, added };
}

const load = (text, path = 'fr.json') => parseLocaleText(text, path);
const merge = (targetText, filledObj, source = null, options = {}) => {
  const filled = load(JSON.stringify(filledObj), 'filled.json');
  return mergeTranslations(load(targetText), filled, { source: source ? load(source, 'en.json') : null, ...options });
};

const SOURCE = `{
  "app": {
    "title": "My App",
    "greeting": "Hello",
    "save": "Save",
    "cancel": "Cancel"
  },
  "bye": "Goodbye",
  "zoo": "Zoo"
}
`;

const TARGET = `{
  "app": {
    "greeting": "Bonjour",
    "cancel": "Annuler"
  },
  "bye": "Au revoir"
}
`;

test('inserts missing keys in source order and only adds lines (LF, 2 spaces)', () => {
  const result = merge(TARGET, { app: { title: 'Mon appli', save: 'Enregistrer' } }, SOURCE);
  assert.equal(
    result.text,
    `{
  "app": {
    "title": "Mon appli",
    "greeting": "Bonjour",
    "save": "Enregistrer",
    "cancel": "Annuler"
  },
  "bye": "Au revoir"
}
`,
  );
  const diff = lineDiff(TARGET, result.text);
  assert.deepEqual(diff.removed, []);
  assert.equal(diff.added.length, 2);
  assert.deepEqual(result.added, ['app.title', 'app.save']);
  assert.deepEqual(JSON.parse(result.text), {
    app: { title: 'Mon appli', greeting: 'Bonjour', save: 'Enregistrer', cancel: 'Annuler' },
    bye: 'Au revoir',
  });
});

test('appending after the last member changes only that line, by a comma', () => {
  const result = merge(TARGET, { zoo: 'Zoo FR' }, SOURCE);
  const diff = lineDiff(TARGET, result.text);
  assert.deepEqual(diff.removed, ['  "bye": "Au revoir"']);
  assert.deepEqual(diff.added, ['  "bye": "Au revoir",', '  "zoo": "Zoo FR"']);
  assert.ok(result.text.endsWith('}\n'));
});

test('without a source file the order of the filled file is used', () => {
  const result = merge(TARGET, { app: { title: 'Mon appli', greeting: 'Salut', save: 'Enregistrer' } });
  assert.deepEqual(Object.keys(JSON.parse(result.text).app), ['title', 'greeting', 'save', 'cancel']);
  assert.equal(JSON.parse(result.text).app.greeting, 'Bonjour', 'existing translation is kept');
  assert.deepEqual(result.kept, ['app.greeting']);
});

test('preserves CRLF line endings and the absence of a trailing newline', () => {
  const target = TARGET.replace(/\n/g, '\r\n').replace(/\r\n$/, '');
  const result = merge(target, { app: { title: 'Mon appli' } }, SOURCE);
  assert.ok(!result.text.endsWith('\n'));
  assert.ok(!/[^\r]\n/.test(result.text), 'every newline is still CRLF');
  assert.ok(result.text.includes('    "title": "Mon appli",\r\n'));
  const diff = lineDiff(target.replace(/\r/g, ''), result.text.replace(/\r/g, ''));
  assert.deepEqual(diff.removed, []);
});

test('preserves four-space and tab indentation', () => {
  const four = TARGET.replace(/^( +)/gm, (m) => m + m);
  const fourResult = merge(four, { app: { title: 'Mon appli' } }, SOURCE);
  assert.ok(fourResult.text.includes('\n        "title": "Mon appli",\n'));
  assert.deepEqual(lineDiff(four, fourResult.text).removed, []);

  const tabs = TARGET.replace(/^( +)/gm, (m) => '\t'.repeat(m.length / 2));
  const tabResult = merge(tabs, { app: { title: 'Mon appli' } }, SOURCE);
  assert.ok(tabResult.text.includes('\n\t\t"title": "Mon appli",\n'));
  assert.deepEqual(lineDiff(tabs, tabResult.text).removed, []);
});

test('creates missing parent objects with the file indentation', () => {
  const target = '{\n    "bye": "Au revoir"\n}\n';
  const source = '{"app": {"title": "T", "save": "S"}, "bye": "B"}';
  const result = merge(target, { app: { title: 'Titre', save: 'Sauver' } }, source);
  assert.equal(
    result.text,
    '{\n    "app": {\n        "title": "Titre",\n        "save": "Sauver"\n    },\n    "bye": "Au revoir"\n}\n',
  );
});

test('fills empty values in place and keeps non-empty ones unless --overwrite', () => {
  const target = '{\n  "a": "",\n  "b": "old",\n  "c": null\n}\n';
  const plain = merge(target, { a: 'A', b: 'new', c: 'C' });
  assert.equal(plain.text, '{\n  "a": "A",\n  "b": "old",\n  "c": "C"\n}\n');
  assert.deepEqual(plain.filled, ['a', 'c']);
  assert.deepEqual(plain.kept, ['b']);
  const over = merge(target, { b: 'new' }, null, { overwrite: true });
  assert.equal(over.text, '{\n  "a": "",\n  "b": "new",\n  "c": null\n}\n');
  assert.deepEqual(over.overwritten, ['b']);
});

test('flat targets get flat keys', () => {
  const target = '{\n  "app.greeting": "Bonjour",\n  "bye": "Au revoir"\n}\n';
  const source = '{"app.title": "T", "app.greeting": "G", "bye": "B"}';
  const result = merge(target, { 'app.title': 'Titre' }, source);
  assert.equal(result.text, '{\n  "app.title": "Titre",\n  "app.greeting": "Bonjour",\n  "bye": "Au revoir"\n}\n');
});

test('a nested filled file merges into a flat target and vice versa', () => {
  const flat = merge('{\n  "x.y": "Z",\n  "bye": "Au revoir"\n}\n', { app: { title: 'Titre' } });
  assert.ok(flat.text.includes('"app.title": "Titre"'));
  const nested = merge('{\n  "app": {\n    "x": "X"\n  }\n}\n', { 'app.title': 'Titre' });
  assert.deepEqual(JSON.parse(nested.text), { app: { x: 'X', title: 'Titre' } });
});

test('an empty target gets a fresh file in the style of the filled file', () => {
  const result = merge('{}\n', { app: { title: 'Titre' }, bye: 'Au revoir' });
  assert.equal(result.text, '{\n  "app": {\n    "title": "Titre"\n  },\n  "bye": "Au revoir"\n}\n');
});

test('compact single-line files stay on one line', () => {
  const target = '{"a": "A", "c": "C"}';
  const source = '{"a": "1", "b": "2", "c": "3", "d": "4"}';
  const result = merge(target, { b: 'B', d: 'D' }, source);
  assert.equal(result.text, '{"a": "A", "b": "B", "c": "C", "d": "D"}');
  const tight = merge('{"a":"A","c":"C"}', { b: 'B' }, source);
  assert.equal(tight.text, '{"a":"A","b":"B","c":"C"}');
  const first = merge('{"c":"C"}', { a: 'A' }, source);
  assert.equal(first.text, '{"a":"A","c":"C"}');
});

test('keys unknown to the source are skipped', () => {
  const result = merge(TARGET, { bogus: 'x', app: { title: 'Mon appli' } }, SOURCE);
  assert.deepEqual(result.skipped, [{ key: 'bogus', reason: 'unknown-key' }]);
  assert.ok(!result.text.includes('bogus'));
});

test('blank and non-string translations are skipped', () => {
  const result = merge(TARGET, { app: { title: '', save: 3 } }, SOURCE);
  assert.deepEqual(result.skipped.map((item) => item.reason), ['empty-value', 'empty-value']);
  assert.equal(result.text, TARGET);
});

test('a key that would clash with an existing value is skipped', () => {
  const result = merge('{\n  "a": "A"\n}\n', { a: { b: 'B' } });
  assert.deepEqual(result.skipped, [{ key: 'a.b', reason: 'type-conflict' }]);
  assert.equal(result.text, '{\n  "a": "A"\n}\n');
});

test('plural forms needed by the target language are accepted and ordered', () => {
  const source = '{\n  "item_one": "{{count}} item",\n  "item_other": "{{count}} items",\n  "z": "Z"\n}\n';
  const target = '{\n  "item_one": "{{count}} élément",\n  "item_other": "{{count}} éléments",\n  "z": "Z"\n}\n';
  const result = merge(target, { item_many: '{{count}} d’éléments' }, source);
  assert.deepEqual(Object.keys(JSON.parse(result.text)), ['item_one', 'item_many', 'item_other', 'z']);
  assert.deepEqual(lineDiff(target, result.text).removed, []);
});

test('unicode and escapes in values survive', () => {
  const result = merge('{\n  "a": "A"\n}\n', { b: 'Café "quoted"\nnew line ☃' });
  assert.equal(JSON.parse(result.text).b, 'Café "quoted"\nnew line ☃');
  assert.ok(result.text.includes('Café'), 'non-ASCII characters are not escaped');
});

test('a byte order mark is preserved', () => {
  const result = merge(`\uFEFF${TARGET}`, { app: { title: 'Mon appli' } }, SOURCE);
  assert.equal(result.text.charCodeAt(0), 0xfeff);
  assert.deepEqual(lineDiff(`\uFEFF${TARGET}`, result.text).removed, []);
});

test('big file: many insertions keep every original line in place', () => {
  const keys = Array.from({ length: 300 }, (_, i) => `k${String(i).padStart(3, '0')}`);
  const sourceObj = Object.fromEntries(keys.map((k) => [k, `v ${k}`]));
  const kept = keys.filter((_, i) => i % 3 !== 2);
  const targetText = `${JSON.stringify(Object.fromEntries(kept.map((k) => [k, `t ${k}`])), null, 2)}\n`;
  const missing = Object.fromEntries(keys.filter((_, i) => i % 3 === 2).map((k) => [k, `t ${k}`]));
  const result = merge(targetText, missing, JSON.stringify(sourceObj));
  assert.equal(result.text, `${JSON.stringify(Object.fromEntries(keys.map((k) => [k, `t ${k}`])), null, 2)}\n`);
  assert.deepEqual(lineDiff(targetText, result.text).removed, [`  "${kept[kept.length - 1]}": "t ${kept[kept.length - 1]}"`]);
});
