import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { CHECKS, compareFiles, validateCheckNames } from './compare.js';
import { loadConfig } from './config.js';
import { exportMissing } from './export.js';
import { InputError, loadLocaleFile, parseLocaleText } from './files.js';
import { globToRegExp } from './messages.js';
import { mergeTranslations } from './merge.js';
import {
  countIssues,
  formatGithub,
  formatJson,
  formatMarkdown,
  formatStatsJson,
  formatStatsText,
  formatStatsMarkdown,
  formatText,
} from './report.js';

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const HELP = `i18n-diff ${VERSION}
Compare translation JSON files against a source locale.

Usage:
  i18n-diff check <source.json> <target.json...> [options]
  i18n-diff export-missing <source.json> <target.json> [options]
  i18n-diff merge <target.json> <filled.json> [options]
  i18n-diff stats <source.json> <target.json...> [options]

check options:
  --format <text|json|github|markdown> Output format (default: text)
  --max-issues <count>          Markdown row limit (default: 200)
  --ignore <checks>             Comma-separated checks to skip
                                (${CHECKS.join(', ')})
  --warnings-as-errors          Exit 1 on warnings too
  --allow-key <pattern>         Key allowed to equal the source (* and ? wildcards); repeatable
  --allow-value <text>          Value allowed to equal the source; repeatable
  --locale <tag>                Locale of the target, instead of detecting it
  --source-locale <tag>         Locale of the source, instead of detecting it
  --config <file>               Config file (default: ./.i18n-diff.json when present)

export-missing options:
  -o, --output <file>           Write to a file instead of stdout
  --only-missing                Skip keys that exist but are empty
  --include-untranslated        Also list keys identical to the source
  --shape <auto|nested|flat>    Shape of the output (default: auto, follows the source)
  --locale <tag>                Locale of the target

merge options:
  --source <file>               Source file: fixes key order and rejects unknown keys
  --overwrite                   Replace existing non-empty translations too
  --dry-run                     Show what would change, write nothing
  -o, --output <file>           Write the result to another file

stats options:
  --format <text|json|markdown> Output format (default: text)
  --sort <completion>           Lowest completion first
  --min <percent>               Exit 1 when any file is below this completion
  --locale <tag>, --source-locale <tag>, --config <file>

Exit codes: 0 ok, 1 problems found, 2 usage or input error.
`;

const OPTIONS = {
  format: { type: 'string' },
  ignore: { type: 'string', multiple: true },
  'warnings-as-errors': { type: 'boolean' },
  'allow-key': { type: 'string', multiple: true },
  'allow-value': { type: 'string', multiple: true },
  locale: { type: 'string' },
  'source-locale': { type: 'string' },
  config: { type: 'string' },
  output: { type: 'string', short: 'o' },
  'only-missing': { type: 'boolean' },
  'include-untranslated': { type: 'boolean' },
  shape: { type: 'string' },
  source: { type: 'string' },
  overwrite: { type: 'boolean' },
  'dry-run': { type: 'boolean' },
  min: { type: 'string' },
  sort: { type: 'string' },
  'max-issues': { type: 'string' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
};

const COMMAND_OPTIONS = {
  check: ['format', 'max-issues', 'ignore', 'warnings-as-errors', 'allow-key', 'allow-value', 'locale', 'source-locale', 'config'],
  'export-missing': ['output', 'only-missing', 'include-untranslated', 'shape', 'locale', 'source-locale', 'ignore', 'allow-key', 'allow-value', 'config'],
  merge: ['source', 'overwrite', 'dry-run', 'output'],
  stats: ['format', 'min', 'sort', 'locale', 'source-locale', 'ignore', 'allow-key', 'allow-value', 'config'],
};

/** Expands `*` and `?` in the last path segment; other arguments pass through. */
export function expandArgs(args) {
  const files = [];
  for (const arg of args) {
    if (!/[*?]/.test(basename(arg)) || existsSync(arg)) {
      files.push(arg);
      continue;
    }
    const dir = dirname(arg);
    const pattern = globToRegExp(basename(arg));
    let names = [];
    try {
      names = readdirSync(dir).filter((name) => pattern.test(name)).sort();
    } catch {
      // handled below as "no match"
    }
    if (names.length === 0) throw new InputError(`No files match ${arg}`);
    files.push(...names.map((name) => join(dir, name)));
  }
  return files;
}

function splitList(values = []) {
  return values.flatMap((value) => value.split(',')).map((item) => item.trim()).filter(Boolean);
}

function compareOptions(values, config) {
  const ignore = [...(config.ignore ?? []), ...splitList(values.ignore)];
  validateCheckNames(ignore);
  return {
    ignore,
    allowKeys: [...(config.allowKeys ?? []), ...(values['allow-key'] ?? [])],
    allowValues: [...(config.allowValues ?? []), ...(values['allow-value'] ?? [])],
    locale: values.locale,
    sourceLocale: values['source-locale'] ?? config.sourceLocale,
  };
}

function loadTarget(path) {
  try {
    return { target: loadLocaleFile(path) };
  } catch (error) {
    if (error instanceof InputError) return { error };
    throw error;
  }
}

function runCheck(positionals, values, config, io) {
  if (positionals.length < 2) throw new InputError('check needs a source file and at least one target file');
  const [sourcePath, ...targetArgs] = positionals;
  const source = loadLocaleFile(sourcePath);
  const sourceFull = resolve(sourcePath);
  const targets = expandArgs(targetArgs).filter((path) => resolve(path) !== sourceFull);
  if (targets.length === 0) throw new InputError('No target files to check');
  const options = compareOptions(values, config);
  const format = values.format ?? config.format ?? 'text';
  if (!['text', 'json', 'github', 'markdown'].includes(format)) throw new InputError(`Unknown format "${format}"`);
  const maxIssues = values['max-issues'] === undefined ? 200 : Number(values['max-issues']);
  if (!Number.isSafeInteger(maxIssues) || maxIssues < 0 || values['max-issues']?.trim() === '') {
    throw new InputError('--max-issues must be a non-negative integer');
  }

  const results = targets.map((path) => {
    const loaded = loadTarget(path);
    if (loaded.error) {
      return {
        file: path,
        locale: null,
        summary: {},
        issues: [{ code: 'invalid-file', severity: 'error', key: '-', message: loaded.error.message }],
      };
    }
    return compareFiles(source, loaded.target, options);
  });
  const render = { text: formatText, json: formatJson, github: formatGithub, markdown: formatMarkdown }[format];
  io.stdout(render(results, { maxIssues }));
  const { errors, warnings } = countIssues(results);
  const strict = values['warnings-as-errors'] ?? config.warningsAsErrors ?? false;
  return errors > 0 || (strict && warnings > 0) ? 1 : 0;
}

function runExport(positionals, values, config, io) {
  if (positionals.length !== 2) throw new InputError('export-missing needs a source file and one target file');
  const [sourcePath, targetPath] = positionals;
  const shape = values.shape ?? 'auto';
  if (!['auto', 'nested', 'flat'].includes(shape)) throw new InputError(`Unknown shape "${shape}"`);
  const source = loadLocaleFile(sourcePath);
  const target = existsSync(targetPath) ? loadLocaleFile(targetPath) : parseLocaleText('{}\n', targetPath);
  const result = exportMissing(source, target, {
    ...compareOptions(values, config),
    onlyMissing: values['only-missing'],
    includeUntranslated: values['include-untranslated'],
    shape,
  });
  if (values.output) {
    writeFileSync(values.output, result.text);
    io.stdout(`Wrote ${result.count} key${result.count === 1 ? '' : 's'} to ${values.output}\n`);
  } else {
    io.stdout(result.text);
    io.stderr(`${result.count} key${result.count === 1 ? '' : 's'} to translate\n`);
  }
  return 0;
}

function runMerge(positionals, values, io) {
  if (positionals.length !== 2) throw new InputError('merge needs a target file and a filled file');
  const [targetPath, filledPath] = positionals;
  const target = existsSync(targetPath) ? loadLocaleFile(targetPath) : parseLocaleText('{}\n', targetPath);
  const filled = loadLocaleFile(filledPath);
  const source = values.source ? loadLocaleFile(values.source) : null;
  const result = mergeTranslations(target, filled, { source, overwrite: values.overwrite });
  const outPath = values.output ?? targetPath;
  const lines = [
    `added ${result.added.length}, filled ${result.filled.length}, overwritten ${result.overwritten.length}, kept ${result.kept.length}, skipped ${result.skipped.length}`,
    ...result.skipped.map((item) => `  skipped ${item.key} (${item.reason})`),
  ];
  if (values['dry-run']) {
    lines.unshift(`Dry run: ${outPath} not written`);
  } else {
    writeFileSync(outPath, result.text);
    lines.unshift(`Merged into ${outPath}`);
  }
  io.stdout(`${lines.join('\n')}\n`);
  return 0;
}

function runStats(positionals, values, config, io) {
  if (positionals.length < 2) throw new InputError('stats needs a source file and at least one target file');
  const [sourcePath, ...targetArgs] = positionals;
  const source = loadLocaleFile(sourcePath);
  const sourceFull = resolve(sourcePath);
  const targets = expandArgs(targetArgs).filter((path) => resolve(path) !== sourceFull);
  if (targets.length === 0) throw new InputError('No target files');
  const format = values.format ?? 'text';
  if (!['text', 'json', 'markdown'].includes(format)) throw new InputError(`Unknown format "${format}"`);
  if (values.sort !== undefined && values.sort !== 'completion') throw new InputError(`Unknown sort "${values.sort}"`);
  const min = values.min === undefined ? null : Number(values.min);
  if (min !== null && (Number.isNaN(min) || min < 0 || min > 100)) {
    throw new InputError('--min must be a number between 0 and 100');
  }
  const options = compareOptions(values, config);
  const rows = targets.map((path) => {
    const result = compareFiles(source, loadLocaleFile(path), options);
    return { file: path, locale: result.locale, ...result.summary };
  });
  if (values.sort === 'completion') rows.sort((a, b) => a.percent - b.percent || a.file.localeCompare(b.file));
  io.stdout(({ json: formatStatsJson, text: formatStatsText, markdown: formatStatsMarkdown })[format](rows));
  return rows.some((row) => row.percent < (min ?? config.minCompletion?.[row.locale]
    ?? config.minCompletion?.default ?? 0)) ? 1 : 0;
}

/**
 * Runs the CLI. Returns the process exit code.
 * `io` provides stdout/stderr writers so tests can capture output.
 */
export function run(argv, io = {}, cwd = process.cwd()) {
  const out = {
    stdout: io.stdout ?? ((text) => process.stdout.write(text)),
    stderr: io.stderr ?? ((text) => process.stderr.write(text)),
  };
  try {
    const { values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
    if (values.version) {
      out.stdout(`${VERSION}\n`);
      return 0;
    }
    const [command, ...rest] = positionals;
    if (values.help || !command || command === 'help') {
      out.stdout(HELP);
      return values.help || command === 'help' ? 0 : 2;
    }
    const allowed = COMMAND_OPTIONS[command];
    if (!allowed) throw new InputError(`Unknown command "${command}". Run i18n-diff --help.`);
    for (const name of Object.keys(values)) {
      if (!allowed.includes(name)) throw new InputError(`Option --${name} is not valid for "${command}"`);
    }
    const config = command === 'merge' ? {} : loadConfig(values.config, cwd);
    if (command === 'check') return runCheck(rest, values, config, out);
    if (command === 'export-missing') return runExport(rest, values, config, out);
    if (command === 'merge') return runMerge(rest, values, out);
    return runStats(rest, values, config, out);
  } catch (error) {
    if (error instanceof InputError || error?.code?.startsWith?.('ERR_PARSE_ARGS')) {
      out.stderr(`i18n-diff: ${error.message}\n`);
      return 2;
    }
    throw error;
  }
}
