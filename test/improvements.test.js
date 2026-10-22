import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { run } from '../src/cli.js';
import { compareFiles } from '../src/compare.js';
import { parseLocaleText } from '../src/files.js';
import { formatGithub, formatMarkdown } from '../src/report.js';

const tmp = mkdtempSync(path.join(tmpdir(), 'i18n-improvements-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
function cli(args, cwd = tmp) {
  let stdout = '';
  let stderr = '';
  const code = run(args, { stdout: (s) => { stdout += s; }, stderr: (s) => { stderr += s; } }, cwd);
  return { code, stdout, stderr };
}

test('GitHub annotations use forward slashes for win32 and real fixture paths', () => {
  const fixture = fileURLToPath(new URL('./fixtures/fr.json', import.meta.url));
  const expected = path.relative(process.cwd(), fixture).replace(/\\/g, '/');
  for (const file of [path.win32.join('test', 'fixtures', 'fr.json'), fixture, path.win32.normalize(fixture)]) {
    const output = formatGithub([{ file, issues: [
      { code: 'missing', key: 'a', severity: 'error' },
      { code: 'empty', key: 'b', severity: 'error', message: 'Empty', line: 2, column: 3 },
    ] }]);
    assert.match(output, /file=test\/fixtures\/fr.json[,]/);
    assert.ok(output.includes(`file=${expected},`));
    assert.ok(!output.includes('\\'));
  }
  const external = formatGithub([{ file: 'Z:\\outside\\fr.json', issues: [
    { code: 'missing', key: 'a', severity: 'error' },
  ] }]);
  assert.match(external, /file=Z%3A\/outside\/fr.json,/);
});

const errorCases = [
  ['not-found', null, /File not found:/],
  ['directory', null, /Expected a file, got a directory:/],
  ['invalid', '{\n  "a": 1,\n    }', /Trailing commas are not supported.*line 2, column 9/],
  ['syntax', '{\n  "a":\n    @\n}', /Not valid JSON at line 3, column 5: Unexpected character "@"/],
  ['empty', '', /Not valid JSON at line 1, column 1: Unexpected end of input/],
  ['bom-only', '\uFEFF', /Not valid JSON at line 1, column 2: Unexpected end of input/],
];
for (const [name, text, message] of errorCases) {
  test(`CLI file errors: ${name}`, () => {
    const file = path.join(tmp, `${name}.json`);
    if (name === 'directory') mkdirSync(file);
    else if (text !== null) writeFileSync(file, text);
    const source = path.join(tmp, 'en.json');
    writeFileSync(source, '{"a":"Hello"}');
    const fatal = cli(['check', file, source]);
    assert.equal(fatal.code, 2);
    assert.match(fatal.stderr, message);
    assert.doesNotMatch(fatal.stderr, /ENOENT|EISDIR|EPERM/);
    const target = cli(['check', source, file, '--format', 'json']);
    assert.equal(target.code, 1);
    const issue = JSON.parse(target.stdout).files[0].issues[0];
    assert.equal(issue.code, 'invalid-file');
    assert.match(issue.message, message);
  });
}

for (const [name, text, message] of [
  ['line comment', '{\n\n\n// example\n"a":"b"}', /Comments are not supported in JSON files \(line 4, column 1\)/],
  ['block comment', '{"a": /* example */ "b"}', /Comments are not supported.*line 1, column 7/],
  ['object comma', '{"a":"b",}', /Trailing commas are not supported.*line 1, column 9/],
  ['array comma', '{"a":["b",]}', /Trailing commas are not supported.*line 1, column 10/],
  ['comment before comma', '{"a":"b" /* first */,}', /Comments are not supported/],
  ['comma before comment', '{"a":"b",}\n// later', /Trailing commas are not supported/],
]) {
  test(`invalid-file names the first unsupported token: ${name}`, () => {
    const source = path.join(tmp, 'valid.json');
    const target = path.join(tmp, `${name.replaceAll(' ', '-')}.json`);
    writeFileSync(source, '{}');
    writeFileSync(target, text);
    const result = cli(['check', source, target, '--format', 'json']);
    assert.equal(result.code, 1);
    assert.match(JSON.parse(result.stdout).files[0].issues[0].message, message);
    assert.throws(() => parseLocaleText(text), message);
  });
}

test('comment markers inside strings are ordinary data', () => {
  assert.equal(parseLocaleText('{"url":"https://example.invalid/*x*/"}').entries.get('url').value,
    'https://example.invalid/*x*/');
});

test('duplicates are scoped to objects, including duplicate container keys', () => {
  const file = parseLocaleText('{"a":"first","a":"last","x":{"a":"one","a":"two"},"y":{"a":"ok"},"z":{},"z":{}}', 'en.json');
  assert.deepEqual(file.duplicates.map((d) => d.key), ['a', 'x.a', 'z']);
  assert.equal(file.entries.get('a').value, 'last');
  assert.equal(file.entries.get('x.a').value, 'two');
  const issues = compareFiles(file, parseLocaleText('{}', 'fr.json')).issues;
  assert.deepEqual(issues.filter((i) => i.code === 'duplicate-key').map((i) => i.key), ['a', 'x.a', 'z']);
});

test('literal dots and nested paths agree across files but collide within a file', () => {
  const nested = parseLocaleText('{"a":{"b":"Hello"}}', 'en.json');
  const flat = parseLocaleText('{"a.b":"Bonjour"}', 'fr.json');
  assert.deepEqual(compareFiles(nested, flat).issues, []);
  for (const text of ['{"a.b":"Hello","a":{"b":"Last"}}', '{"a":{"b":"Hello"},"a.b":"Last"}']) {
    const collision = parseLocaleText(text, 'en.json');
    assert.equal(collision.entries.get('a.b').value, 'Last');
    assert.deepEqual(collision.duplicates, []);
    for (const [source, target] of [[collision, flat], [nested, collision]]) {
      const issue = compareFiles(source, target).issues.find((i) => i.code === 'key-collision');
      assert.equal(issue.key, 'a.b');
      assert.equal(issue.severity, 'error');
      assert.equal(issue.file, collision.path);
    }
  }
});

test('markdown check output defaults to 200 rows, supports a cap, and keeps all errors for exit status', () => {
  const source = path.join(tmp, 'many-en.json');
  const target = path.join(tmp, 'many-fr.json');
  writeFileSync(source, JSON.stringify(Object.fromEntries(Array.from({ length: 205 }, (_, n) => [`k${n}`, 'Hello']))));
  writeFileSync(target, '{}');
  const args = ['check', source, target, '--format', 'markdown'];
  const result = cli(args);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /^\| File \| Key \| Check \| Message \|/);
  assert.match(result.stdout, /\| k199 \| missing \| Missing key/);
  assert.doesNotMatch(result.stdout, /\| k200 \|/);
  assert.match(result.stdout, /\.\.\. and 5 more\n$/);
  assert.match(cli([...args, '--max-issues', '2']).stdout, /\.\.\. and 203 more/);
  assert.match(cli([...args, '--max-issues', '0']).stdout, /\.\.\. and 205 more/);
  for (const cap of ['-1', '1.5', 'NaN', '']) assert.equal(cli([...args, '--max-issues', cap]).code, 2);
  const escaped = formatMarkdown([{ file: '<file>', issues: [{ key: 'a|b', code: 'empty', message: 'a\nb`c' }] }]);
  assert.match(escaped, /&lt;file&gt; \| a&#124;b \| empty \| a<br>b&#96;c/);
});

test('stats markdown, completion sorting, per-locale minimum and CLI precedence', () => {
  const source = path.join(tmp, 'stats-en.json');
  const de = path.join(tmp, 'de.json');
  const fr = path.join(tmp, 'fr.json');
  writeFileSync(source, '{"a":"Hello","b":"Bye"}');
  writeFileSync(de, '{"a":"Hallo"}');
  writeFileSync(fr, '{"a":"Bonjour","b":"Salut"}');
  const args = ['stats', source, fr, de];
  const markdown = cli([...args, '--format', 'markdown', '--sort', 'completion']);
  assert.match(markdown.stdout, /^\| File \| Locale \| Translated/);
  assert.ok(markdown.stdout.indexOf('| de | 1/2') < markdown.stdout.indexOf('| fr | 2/2'));
  assert.match(markdown.stdout, /\| 50.0% \|/);
  const sorted = JSON.parse(cli([...args, '--format', 'json', '--sort', 'completion']).stdout);
  assert.deepEqual(sorted.files.map((r) => r.locale), ['de', 'fr']);
  const config = path.join(tmp, 'stats-config.json');
  const configured = [...args, '--config', config];
  writeFileSync(config, JSON.stringify({ minCompletion: { default: 90, de: 100 } }));
  assert.equal(cli(configured).code, 1);
  assert.equal(cli([...configured, '--min', '50']).code, 0);
  writeFileSync(config, JSON.stringify({ minCompletion: { default: 90, de: 50 } }));
  assert.equal(cli(configured).code, 0);
  writeFileSync(config, JSON.stringify({ minCompletion: { default: 100 } }));
  assert.equal(cli(configured).code, 1);
  assert.equal(cli([...args, '--sort', 'random']).code, 2);
  for (const minCompletion of [null, [], 90, { de: '100' }, { default: 101 }, { de: -1 }]) {
    writeFileSync(config, JSON.stringify({ minCompletion }));
    assert.equal(cli(configured).code, 2);
  }
});
