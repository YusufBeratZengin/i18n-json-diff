import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { run } from '../src/cli.js';

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const bin = fileURLToPath(new URL('../bin/i18n-diff.js', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'i18n-diff-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

function cli(args, cwd = tmp) {
  let stdout = '';
  let stderr = '';
  const code = run(args, { stdout: (t) => (stdout += t), stderr: (t) => (stderr += t) }, cwd);
  return { code, stdout, stderr };
}

test('check: text output, exit code 1 on errors', () => {
  const { code, stdout } = cli(['check', fixture('en.json'), fixture('fr.json')]);
  assert.equal(code, 1);
  assert.match(stdout, /fr\.json \(fr\)/);
  assert.match(stdout, /missing\s+app\.title/);
  assert.match(stdout, /placeholder\s+app\.greeting\s+Placeholder mismatch: missing \{name\}; unexpected \{nom\}/);
  assert.match(stdout, /1 file checked: 7 errors, 2 warnings/);
});

test('check: a clean translation exits 0', () => {
  const { code, stdout } = cli(['check', fixture('en.json'), fixture('ru.json')]);
  assert.equal(code, 0, stdout);
  assert.match(stdout, /OK/);
});

test('check: warnings only exit 0, unless --warnings-as-errors', () => {
  const dir = mkdtempSync(join(tmp, 'w-'));
  writeFileSync(join(dir, 'en.json'), '{"a": "Hello"}');
  writeFileSync(join(dir, 'fr.json'), '{"a": "Hello"}');
  assert.equal(cli(['check', join(dir, 'en.json'), join(dir, 'fr.json')]).code, 0);
  assert.equal(cli(['check', join(dir, 'en.json'), join(dir, 'fr.json'), '--warnings-as-errors']).code, 1);
  assert.equal(cli(['check', join(dir, 'en.json'), join(dir, 'fr.json'), '--warnings-as-errors', '--ignore', 'untranslated']).code, 0);
  assert.equal(cli(['check', join(dir, 'en.json'), join(dir, 'fr.json'), '--warnings-as-errors', '--allow-value', 'Hello']).code, 0);
});

test('check: json format', () => {
  const { stdout } = cli(['check', fixture('en.json'), fixture('fr.json'), '--format', 'json']);
  const report = JSON.parse(stdout);
  assert.equal(report.summary.errors, 7);
  assert.equal(report.files[0].locale, 'fr');
  const missing = report.files[0].issues.find((issue) => issue.code === 'missing' && issue.key === 'msg_many');
  assert.equal(missing.sourceValue, '{{count}} messages');
  assert.equal(missing.line, null);
});

test('check: github annotations', () => {
  const { stdout } = cli(['check', fixture('en.json'), fixture('fr.json'), '--format', 'github']);
  const lines = stdout.trim().split('\n');
  assert.ok(lines.some((l) => /^::error file=.*fr\.json,title=i18n-diff missing::2 keys missing from this translation: app\.title, msg_many$/.test(l)));
  assert.ok(lines.some((l) => /^::error file=.*fr\.json,line=\d+,col=\d+,title=i18n-diff placeholder::app\.greeting: /.test(l)));
  assert.ok(lines.some((l) => /^::warning file=.*,title=i18n-diff untranslated::/.test(l)));
  assert.match(lines[lines.length - 1], /^i18n-diff: 7 errors, 2 warnings$/);
});

test('check: several targets, the source itself is skipped', () => {
  const { stdout } = cli(['check', fixture('en.json'), fixture('en.json'), fixture('fr.json'), fixture('ru.json')]);
  assert.match(stdout, /2 files checked/);
});

test('check: glob in the last path segment', () => {
  const dir = mkdtempSync(join(tmp, 'g-'));
  copyFileSync(fixture('en.json'), join(dir, 'en.json'));
  copyFileSync(fixture('fr.json'), join(dir, 'fr.json'));
  copyFileSync(fixture('ru.json'), join(dir, 'ru.json'));
  const { stdout } = cli(['check', join(dir, 'en.json'), join(dir, '*.json')]);
  assert.match(stdout, /2 files checked/);
  assert.equal(cli(['check', join(dir, 'en.json'), join(dir, '*.xyz')]).code, 2);
});

test('check: invalid target JSON is reported as an error, invalid source is fatal', () => {
  const dir = mkdtempSync(join(tmp, 'b-'));
  writeFileSync(join(dir, 'en.json'), '{"a": "A"}');
  writeFileSync(join(dir, 'fr.json'), '{"a": "A",}');
  const result = cli(['check', join(dir, 'en.json'), join(dir, 'fr.json')]);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /invalid-file/);
  assert.match(result.stdout, /Expected a string key at line 1, column 11/);
  const fatal = cli(['check', join(dir, 'fr.json'), join(dir, 'en.json')]);
  assert.equal(fatal.code, 2);
  assert.match(fatal.stderr, /invalid JSON/);
});

test('config file: ignore and allow lists', () => {
  const dir = mkdtempSync(join(tmp, 'c-'));
  writeFileSync(join(dir, 'en.json'), '{"a": "Hello", "b": "B"}');
  writeFileSync(join(dir, 'fr.json'), '{"a": "Hello"}');
  writeFileSync(join(dir, '.i18n-diff.json'), JSON.stringify({ ignore: ['missing'], allowKeys: ['a'] }));
  const { code, stdout } = cli(['check', join(dir, 'en.json'), join(dir, 'fr.json'), '--warnings-as-errors'], dir);
  assert.equal(code, 0, stdout);
  writeFileSync(join(dir, '.i18n-diff.json'), JSON.stringify({ ignorre: [] }));
  assert.equal(cli(['check', join(dir, 'en.json'), join(dir, 'fr.json')], dir).code, 2);
  writeFileSync(join(dir, '.i18n-diff.json'), JSON.stringify({ ignore: ['bogus'] }));
  assert.equal(cli(['check', join(dir, 'en.json'), join(dir, 'fr.json')], dir).code, 2);
});

test('usage errors exit 2', () => {
  assert.equal(cli([]).code, 2);
  assert.equal(cli(['frobnicate']).code, 2);
  assert.equal(cli(['check', fixture('en.json')]).code, 2);
  assert.equal(cli(['check', fixture('en.json'), fixture('fr.json'), '--nope']).code, 2);
  assert.equal(cli(['check', fixture('en.json'), fixture('fr.json'), '--overwrite']).code, 2);
  assert.equal(cli(['check', fixture('en.json'), fixture('fr.json'), '--format', 'xml']).code, 2);
  assert.equal(cli(['check', fixture('en.json'), join(tmp, 'does-not-exist.json')]).code, 1);
  assert.equal(cli(['check', join(tmp, 'does-not-exist.json'), fixture('fr.json')]).code, 2);
});

test('--help and --version', () => {
  const help = cli(['--help']);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /i18n-diff check/);
  const version = cli(['--version']);
  assert.match(version.stdout, /^\d+\.\d+\.\d+\n$/);
});

test('export-missing writes a minimal JSON with source values in source order', () => {
  const { code, stdout, stderr } = cli(['export-missing', fixture('en.json'), fixture('fr.json')]);
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(stdout), {
    app: { title: 'My App', save: 'Save' },
    msg_many: '{{count}} messages',
  });
  assert.match(stderr, /3 keys to translate/);
  assert.ok(stdout.endsWith('\n'));
  const onlyMissing = cli(['export-missing', fixture('en.json'), fixture('fr.json'), '--only-missing']);
  assert.deepEqual(JSON.parse(onlyMissing.stdout), { app: { title: 'My App' }, msg_many: '{{count}} messages' });
  const flat = cli(['export-missing', fixture('en.json'), fixture('fr.json'), '--shape', 'flat', '--include-untranslated']);
  assert.deepEqual(Object.keys(JSON.parse(flat.stdout)), ['app.title', 'app.save', 'app.ok', 'msg_many']);
});

test('export-missing for a language that does not exist yet, to a file', () => {
  const out = join(tmp, 'new-de.json');
  const { code } = cli(['export-missing', fixture('en.json'), join(tmp, 'de.json'), '-o', out]);
  assert.equal(code, 0);
  const data = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(data.cart.welcome, 'Welcome back, {{user}}.');
  assert.equal(data.msg_one, '{{count}} message');
  assert.equal(data.msg_other, '{{count}} messages');
});

test('merge: end to end with export-missing, then check passes the new keys', () => {
  const dir = mkdtempSync(join(tmp, 'm-'));
  const target = join(dir, 'fr.json');
  copyFileSync(fixture('fr.json'), target);
  const before = readFileSync(target, 'utf8');
  const result = cli(['merge', target, fixture('filled-fr.json'), '--source', fixture('en.json')]);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /added 2, filled 1/);
  const after = readFileSync(target, 'utf8');
  const merged = JSON.parse(after);
  assert.equal(merged.app.title, 'Mon appli');
  assert.equal(merged.app.save, 'Enregistrer');
  assert.deepEqual(Object.keys(merged.app).slice(0, 3), ['title', 'greeting', 'save']);
  assert.deepEqual(Object.keys(merged), ['app', 'cart', 'msg_one', 'msg_many', 'msg_other', 'bye']);
  assert.ok(after.endsWith('\n'));
  assert.notEqual(after, before);
  const check = JSON.parse(cli(['check', fixture('en.json'), target, '--format', 'json']).stdout);
  const keys = check.files[0].issues.map((issue) => `${issue.code}:${issue.key}`);
  assert.ok(!keys.includes('missing:app.title'));
  assert.ok(!keys.includes('missing:msg_many'));
  assert.ok(!keys.includes('empty:app.save'));
});

test('merge --dry-run writes nothing; --output writes elsewhere', () => {
  const dir = mkdtempSync(join(tmp, 'd-'));
  const target = join(dir, 'fr.json');
  copyFileSync(fixture('fr.json'), target);
  const before = readFileSync(target, 'utf8');
  const dry = cli(['merge', target, fixture('filled-fr.json'), '--dry-run']);
  assert.match(dry.stdout, /Dry run/);
  assert.equal(readFileSync(target, 'utf8'), before);
  const out = join(dir, 'out.json');
  cli(['merge', target, fixture('filled-fr.json'), '-o', out]);
  assert.equal(readFileSync(target, 'utf8'), before);
  assert.equal(JSON.parse(readFileSync(out, 'utf8')).app.title, 'Mon appli');
});

test('merge creates a missing target file', () => {
  const target = join(mkdtempSync(join(tmp, 'n-')), 'it.json');
  assert.equal(cli(['merge', target, fixture('filled-fr.json')]).code, 0);
  assert.deepEqual(JSON.parse(readFileSync(target, 'utf8')), JSON.parse(readFileSync(fixture('filled-fr.json'), 'utf8')));
});

test('git diff of a merge only contains added lines', (t) => {
  const git = spawnSync('git', ['--version']);
  if (git.status !== 0) return t.skip('git is not available');
  const dir = mkdtempSync(join(tmp, 'git-'));
  const before = join(dir, 'before.json');
  const after = join(dir, 'after.json');
  const filled = join(dir, 'filled.json');
  const original = readFileSync(fixture('fr.json'), 'utf8');
  writeFileSync(before, original);
  writeFileSync(after, original);
  writeFileSync(filled, JSON.stringify({ app: { title: 'Mon appli' }, msg_many: '{{count}} de messages' }));
  assert.equal(cli(['merge', after, filled, '--source', fixture('en.json')]).code, 0);
  const diff = spawnSync('git', ['diff', '--no-index', '--numstat', before, after], { encoding: 'utf8' });
  const [added, removed] = diff.stdout.trim().split(/\s+/).map(Number);
  assert.equal(added, 2, diff.stdout);
  assert.equal(removed, 0, diff.stdout);
});

test('stats: table, json and --min', () => {
  const table = cli(['stats', fixture('en.json'), fixture('fr.json'), fixture('ru.json')]);
  assert.equal(table.code, 0);
  assert.match(table.stdout, /^File\s+Locale\s+Translated\s+Missing/);
  assert.match(table.stdout, /fr\.json\s+fr\s+9\/12\s+2\s+1\s+1\s+1\s+75\.0%/);
  assert.match(table.stdout, /ru\.json\s+ru\s+13\/13\s+0\s+0\s+0\s+0\s+100\.0%/);
  const json = JSON.parse(cli(['stats', fixture('en.json'), fixture('fr.json'), '--format', 'json']).stdout);
  assert.equal(json.files[0].percent, 75);
  assert.equal(cli(['stats', fixture('en.json'), fixture('fr.json'), '--min', '80']).code, 1);
  assert.equal(cli(['stats', fixture('en.json'), fixture('fr.json'), '--min', '50']).code, 0);
  assert.equal(cli(['stats', fixture('en.json'), fixture('fr.json'), '--min', 'abc']).code, 2);
});

test('the executable runs and sets the exit code', () => {
  const ok = spawnSync(process.execPath, [bin, 'check', fixture('en.json'), fixture('ru.json')], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  const bad = spawnSync(process.execPath, [bin, 'check', fixture('en.json'), fixture('fr.json')], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /placeholder/);
  const usage = spawnSync(process.execPath, [bin, 'nope'], { encoding: 'utf8' });
  assert.equal(usage.status, 2);
});
