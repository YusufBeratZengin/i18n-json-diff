import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseIcu } from '../src/icu.js';

const ok = (message) => {
  const result = parseIcu(message);
  assert.equal(result.error, null, `unexpected error for ${message}: ${result.error}`);
  return [...result.args].sort();
};
const bad = (message, pattern) => {
  const result = parseIcu(message);
  assert.ok(result.error, `expected an error for ${message}`);
  assert.match(result.error, pattern);
};

test('plain text has no arguments', () => {
  assert.deepEqual(ok('Hello world'), []);
});

test('simple arguments', () => {
  assert.deepEqual(ok('Hello, {name}! You are {age}.'), ['age', 'name']);
  assert.deepEqual(ok('{ spaced }'), ['spaced']);
  assert.deepEqual(ok('Item {0} of {1}'), ['0', '1']);
});

test('typed arguments with and without style', () => {
  assert.deepEqual(ok('{n, number}'), ['n']);
  assert.deepEqual(ok('{n, number, percent}'), ['n']);
  assert.deepEqual(ok("{d, date, ::yyyyMMdd}"), ['d']);
  assert.deepEqual(ok("{d, time, ::{hm}}"), ['d']);
});

test('plural with nested arguments', () => {
  assert.deepEqual(
    ok('{count, plural, =0 {No items for {user}} one {# item} other {# items}}'),
    ['count', 'user'],
  );
});

test('plural with offset', () => {
  assert.deepEqual(
    ok('{n, plural, offset:1 =0 {nobody} =1 {{who}} other {{who} and # others}}'),
    ['n', 'who'],
  );
});

test('select and selectordinal', () => {
  assert.deepEqual(
    ok('{gender, select, male {He} female {She} other {They}} said hi'),
    ['gender'],
  );
  assert.deepEqual(
    ok('{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}'),
    ['n'],
  );
});

test('nested select inside plural', () => {
  assert.deepEqual(
    ok('{n, plural, one {{g, select, m {his} other {their}} item} other {# items}}'),
    ['g', 'n'],
  );
});

test('apostrophe quoting', () => {
  assert.deepEqual(ok("It's fine"), []);
  assert.deepEqual(ok("Use '{' and '}' literally"), []);
  assert.deepEqual(ok("It''s {name}'s"), ['name']);
  assert.deepEqual(ok("'{notAnArgument}' and {real}"), ['real']);
});

test('vue-i18n quoted literal interpolation', () => {
  assert.deepEqual(ok("Mail us at info{'@'}example.com"), []);
});

test('errors: unclosed and unmatched braces', () => {
  bad('Hello {name', /Unclosed/);
  bad('Hello name}', /Unmatched/);
  bad('{n, plural, one {# item} other {# items}', /Unclosed/);
});

test('errors: empty or malformed arguments', () => {
  bad('Hello {}', /Empty argument/);
  bad('{n, }', /Missing argument type/);
  bad('{n foo}', /Expected/);
  bad('{n, banana}', /Unknown argument type/);
});

test('errors: plural and select options', () => {
  bad('{n, plural, one {# item}}', /Missing required "other"/);
  bad('{g, select, male {He}}', /Missing required "other"/);
  bad('{n, plural, many}', /Expected '\{'/);
  bad('{n, plural, bogus {x} other {y}}', /Invalid plural selector/);
  bad('{n, plural, one {a} one {b} other {c}}', /Duplicate selector/);
  bad('{n, plural}', /needs at least one option/);
});

test('errors still report arguments found so far', () => {
  const result = parseIcu('{a} and {b');
  assert.ok(result.error);
  assert.ok(result.args.has('a'));
});
