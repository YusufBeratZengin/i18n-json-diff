import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { compareFiles } from '../src/compare.js';
import { loadLocaleFile, parseLocaleText } from '../src/files.js';

const make = (obj, path) => parseLocaleText(JSON.stringify(obj, null, 2), path);
const run = (source, target, options = {}, targetPath = 'fr.json') =>
  compareFiles(make(source, 'en.json'), make(target, targetPath), options);
const codes = (result) => result.issues.map((issue) => `${issue.code}:${issue.key}`);

test('missing and extra keys, nested and flat spellings agree', () => {
  const result = run({ a: { b: 'B', c: 'C' } }, { 'a.b': 'b', 'a.x': 'x' });
  assert.deepEqual(codes(result), ['missing:a.c', 'extra:a.x']);
  assert.equal(result.issues[0].severity, 'error');
  assert.equal(result.issues[0].sourceValue, 'C');
});

test('empty translations', () => {
  const result = run({ a: 'A', b: 'B', c: 'C' }, { a: '', b: '   ', c: null });
  assert.deepEqual(codes(result), ['empty:a', 'empty:b', 'empty:c']);
});

test('an empty source value is not demanded from the translator', () => {
  const result = run({ a: '' }, { a: '' });
  assert.deepEqual(codes(result), []);
});

test('placeholder mismatch: missing and unexpected', () => {
  const result = run({ a: 'Hi {name}' }, { a: 'Salut {nom}' });
  assert.deepEqual(codes(result), ['placeholder:a']);
  assert.deepEqual(result.issues[0].missing, ['{name}']);
  assert.deepEqual(result.issues[0].unexpected, ['{nom}']);
});

test('placeholder mismatch: braces style changed', () => {
  const result = run({ a: 'Hi {{name}}' }, { a: 'Salut {name}' });
  assert.deepEqual(codes(result), ['placeholder:a']);
});

test('placeholder order does not matter', () => {
  const result = run({ a: '{x} then {y}' }, { a: '{y} puis {x}' });
  assert.deepEqual(codes(result), []);
});

test('ICU syntax error in the translation', () => {
  const result = run(
    { a: '{n, plural, one {# a} other {# b}}' },
    { a: '{n, plural, one {# a}}' },
  );
  assert.deepEqual(codes(result), ['icu-syntax:a']);
  assert.match(result.issues[0].message, /other/);
});

test('ICU error already present in the source is not blamed on the translator', () => {
  const result = run({ a: 'Use { carefully' }, { a: 'Utilisez { avec soin' });
  assert.deepEqual(codes(result), []);
});

test('html tag mismatch', () => {
  const result = run({ a: 'Go <b>now</b>' }, { a: 'Allez maintenant' });
  assert.deepEqual(codes(result), ['html-tag:a']);
  assert.deepEqual(result.issues[0].missing, ['<b>', '</b>']);
});

test('html attributes may differ between languages', () => {
  const result = run({ a: '<a href="/en">Go</a>' }, { a: '<a href="/fr">Aller</a>' });
  assert.deepEqual(codes(result), []);
});

test('identical to source is a warning, with allowlists', () => {
  const source = { a: 'Settings', b: 'OK', c: '{n}', d: 'Docs' };
  const target = { a: 'Settings', b: 'OK', c: '{n}', d: 'Docs' };
  assert.deepEqual(codes(run(source, target)), ['untranslated:a', 'untranslated:b', 'untranslated:d']);
  assert.equal(run(source, target).issues[0].severity, 'warning');
  assert.deepEqual(codes(run(source, target, { allowValues: ['OK'] })), ['untranslated:a', 'untranslated:d']);
  assert.deepEqual(codes(run(source, target, { allowKeys: ['a', 'd'] })), ['untranslated:b']);
  assert.deepEqual(codes(run(source, target, { allowKeys: ['*'] })), []);
});

test('identical check is skipped for the same language', () => {
  const result = run({ a: 'Colour' }, { a: 'Colour' }, {}, 'en-GB.json');
  assert.deepEqual(codes(result), []);
});

test('trailing punctuation mismatch is a warning', () => {
  const result = run({ a: 'Done.', b: 'Really?', c: 'Wait...' }, { a: 'Terminé', b: 'Vraiment ?', c: 'Attendez…' });
  assert.deepEqual(codes(result), ['punctuation:a']);
  assert.equal(result.issues[0].severity, 'warning');
});

test('full-width punctuation counts as equivalent', () => {
  const result = run({ a: 'Done.', b: 'Really?' }, { a: '完成。', b: '真的吗？' }, {}, 'zh.json');
  assert.deepEqual(codes(result), []);
});

test('duplicate keys in the target', () => {
  const source = make({ a: 'A' }, 'en.json');
  const target = parseLocaleText('{\n  "a": "x",\n  "a": "y"\n}\n', 'fr.json');
  const result = compareFiles(source, target);
  assert.deepEqual(codes(result), ['duplicate-key:a']);
  assert.equal(result.issues[0].line, 3);
});

test('ignore removes a check', () => {
  const result = run({ a: 'Hi {x}', b: 'B' }, { a: 'Salut' }, { ignore: ['missing'] });
  assert.deepEqual(codes(result), ['placeholder:a']);
  assert.throws(() => run({}, {}, { ignore: ['nope'] }), /Unknown check/);
});

test('line and column of issues point at the key in the target', () => {
  const source = make({ a: 'A', b: 'B {x}' }, 'en.json');
  const target = parseLocaleText('{\n  "a": "A",\n  "b": "B"\n}\n', 'fr.json');
  const issue = compareFiles(source, target).issues.find((item) => item.code === 'placeholder');
  assert.equal(issue.line, 3);
  assert.equal(issue.column, 3);
});

test('plural forms follow the target language (Russian)', () => {
  const source = { item_one: '{{count}} item', item_other: '{{count}} items' };
  const result = run(source, { item_one: '{{count}} товар', item_other: '{{count}} товара' }, {}, 'ru.json');
  assert.deepEqual(codes(result), ['missing:item_few', 'missing:item_many']);
  assert.equal(result.issues[0].sourceValue, '{{count}} items');
  assert.equal(result.summary.expected, 4);
});

test('plural forms follow the target language (Japanese has only other)', () => {
  const source = { item_one: '{{count}} item', item_other: '{{count}} items' };
  const result = run(source, { item_one: '{{count}} x', item_other: '{{count}} 個' }, {}, 'ja.json');
  assert.deepEqual(codes(result), ['extra:item_one']);
});

test('plural form placeholders: other-form fallback, count may be dropped in one-form', () => {
  const source = { item_one: 'One item', item_other: '{{count}} items' };
  const ok = run(source, { item_one: 'Un élément', item_many: '{{count}} d’éléments', item_other: '{{count}} éléments' }, {}, 'fr.json');
  assert.deepEqual(codes(ok), []);
  const bad = run(source, { item_one: 'Un', item_many: '{{nombre}} d’éléments', item_other: '{{count}} éléments' }, {}, 'fr.json');
  assert.deepEqual(codes(bad), ['placeholder:item_many']);
});

test('a lone *_other key is not treated as a plural group', () => {
  const result = run({ settings_other: 'Other settings' }, { settings_other: 'Autres' }, {}, 'ja.json');
  assert.deepEqual(codes(result), []);
});

test('unknown locale falls back to the plural forms of the source', () => {
  const source = { item_one: '{{count}} item', item_other: '{{count}} items' };
  const result = run(source, { item_one: 'a {{count}}' }, {}, 'translation.json');
  assert.deepEqual(codes(result), ['missing:item_other']);
});

test('locale is detected from file and directory names', async () => {
  const { detectLocale } = await import('../src/locale.js');
  assert.equal(detectLocale('locales/fr.json'), 'fr');
  assert.equal(detectLocale('locales/pt_BR.json'), 'pt-BR');
  assert.equal(detectLocale('i18n/messages.de.json'), 'de');
  assert.equal(detectLocale('locales/ja/common.json'), 'ja');
  assert.equal(detectLocale('locales/common.json'), null);
});

test('summary counts and completion percentage', () => {
  const result = run({ a: 'A', b: 'B', c: 'C', d: 'D' }, { a: 'x', b: '', extra: 'e' });
  assert.deepEqual(
    { ...result.summary },
    { expected: 4, translated: 1, missing: 2, empty: 1, untranslated: 0, extra: 1, percent: 25 },
  );
  assert.deepEqual(result.todo.map((item) => [item.key, item.reason]), [['b', 'empty'], ['c', 'missing'], ['d', 'missing']]);
});

test('fixture files: fr.json reports each kind of problem', () => {
  const source = loadLocaleFile(fileURLToPath(new URL('./fixtures/en.json', import.meta.url)));
  const target = loadLocaleFile(fileURLToPath(new URL('./fixtures/fr.json', import.meta.url)));
  const result = compareFiles(source, target);
  assert.deepEqual(codes(result).sort(), [
    'empty:app.save',
    'extra:app.old',
    'html-tag:app.intro',
    'icu-syntax:cart.items',
    'missing:app.title',
    'missing:msg_many',
    'placeholder:app.greeting',
    'punctuation:cart.welcome',
    'untranslated:app.ok',
  ]);
});
