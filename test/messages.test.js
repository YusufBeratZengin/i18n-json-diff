import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyze, diffCounts, extractTags, hasTranslatableText, trailingPunctuation } from '../src/messages.js';

const names = (message) => [...analyze(message).placeholders].sort();

test('analyze: single, double and mixed placeholders', () => {
  assert.deepEqual(names('Hi {name}'), ['{name}']);
  assert.deepEqual(names('Hi {{name}}'), ['{{name}}']);
  assert.deepEqual(names('{{count, number}} of {{ total }}'), ['{{count}}', '{{total}}']);
  assert.deepEqual(names('{{- raw}}'), ['{{raw}}']);
  assert.deepEqual(names('{{a}} and {b}'), ['{b}', '{{a}}']);
});

test('analyze: i18next nesting and vue-i18n linked messages', () => {
  assert.deepEqual(names('See $t(common.ok) now'), ['$t(common.ok)']);
  assert.deepEqual(names('$t(key, {"count": 2})'), ['$t(key)']);
  assert.deepEqual(names('@:common.ok and @.upper:common.cancel.'), ['@.upper:common.cancel', '@:common.ok']);
});

test('analyze: ICU plural collects nested names and no error', () => {
  const result = analyze('{n, plural, one {{who} left} other {# left}}');
  assert.equal(result.icuError, null);
  assert.deepEqual([...result.placeholders].sort(), ['{n}', '{who}']);
});

test('analyze: syntax error is reported and placeholders fall back to a scan', () => {
  const result = analyze('{a} {n, plural, one {x}}');
  assert.match(result.icuError, /other/);
  assert.ok(result.placeholders.has('{a}'));
});

test('extractTags counts tags and ignores attributes', () => {
  const tags = extractTags('<b>x</b> <a href="/y">z</a> <br> <img src="a.png"/> <0>t</0>');
  assert.equal(tags.get('<b>'), 1);
  assert.equal(tags.get('</b>'), 1);
  assert.equal(tags.get('<a>'), 1);
  assert.equal(tags.get('<br/>'), 1);
  assert.equal(tags.get('<img/>'), 1);
  assert.equal(tags.get('<0>'), 1);
  assert.equal(tags.get('</0>'), 1);
});

test('extractTags does not treat comparisons as tags', () => {
  assert.equal(extractTags('if a < b and c > d').size, 0);
});

test('diffCounts reports missing and unexpected tokens', () => {
  const result = diffCounts(extractTags('<b>x</b>'), extractTags('<i>x</i>'));
  assert.deepEqual(result.missing, ['<b>', '</b>']);
  assert.deepEqual(result.unexpected, ['<i>', '</i>']);
});

test('trailingPunctuation maps equivalent marks', () => {
  assert.equal(trailingPunctuation('Done.'), '.');
  assert.equal(trailingPunctuation('完成。'), '.');
  assert.equal(trailingPunctuation('Really?'), '?');
  assert.equal(trailingPunctuation('هل أنت متأكد؟'), '?');
  assert.equal(trailingPunctuation('Wait...'), '…');
  assert.equal(trailingPunctuation('Wait…'), '…');
  assert.equal(trailingPunctuation('Hello {name}'), '');
  assert.equal(trailingPunctuation('Click <b>here.</b>'), '.');
  assert.equal(trailingPunctuation('Quoted "text."'), '.');
  assert.equal(trailingPunctuation('Τι κάνεις;', 'el'), '?');
});

test('hasTranslatableText ignores placeholders and tags', () => {
  assert.equal(hasTranslatableText('{count}'), false);
  assert.equal(hasTranslatableText('<b>{{n}}</b> 42'), false);
  assert.equal(hasTranslatableText('OK'), true);
  assert.equal(hasTranslatableText('{n} items'), true);
});
