# i18n-json-diff

[![CI](https://github.com/YusufBeratZengin/i18n-json-diff/actions/workflows/ci.yml/badge.svg)](https://github.com/YusufBeratZengin/i18n-json-diff/actions/workflows/ci.yml) [![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/) [![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json) [![npm](https://img.shields.io/npm/v/i18n-json-diff)](https://www.npmjs.com/package/i18n-json-diff)

Find broken translation JSON and merge completed translations while preserving existing formatting.

English | [Türkçe](README.tr.md)

![Terminal demo: a check finds 7 errors and 2 warnings in the sample French translations](docs/demo.svg)

## Why

- Catch broken messages, not just missing keys: validate placeholders, ICU syntax, HTML tags and the plural categories each locale needs via `Intl.PluralRules`.
- Keep translation reviews small: merge by patching the original JSON text, preserving indentation, line endings and existing translations.
- Run locally with zero runtime dependencies: nested and flat JSON, Node.js >=20, and text, JSON, Markdown or GitHub Actions output.

## Quick start

Try the included synthetic locales from a checkout; no install is needed for the CLI:

```sh
git clone https://github.com/YusufBeratZengin/i18n-json-diff.git
cd i18n-json-diff
node bin/i18n-diff.js check test/fixtures/en.json test/fixtures/ru.json
node bin/i18n-diff.js check test/fixtures/en.json test/fixtures/fr.json
```

The Russian sample passes (exit `0`). The French sample deliberately contains problems (exit `1`); its actual output is shown below.

For your own project, install the package once it is available on npm:

```sh
npm install --save-dev i18n-json-diff
# or run it once
npx --package i18n-json-diff i18n-diff check locales/en.json 'locales/*.json'
```

To install the current GitHub version:
`npm install --save-dev github:YusufBeratZengin/i18n-json-diff`.

The command is `i18n-diff`.

## Demo

```sh
node bin/i18n-diff.js check test/fixtures/en.json test/fixtures/fr.json
```

```text
test/fixtures/fr.json (fr)
  -     error    missing       app.title     Missing key (source: "My App")
  3:5   error    placeholder   app.greeting  Placeholder mismatch: missing {name}; unexpected {nom}
  4:5   error    empty         app.save      Translation is empty
  5:5   error    html-tag      app.intro     HTML tag mismatch: missing <b>, </b>
  6:5   warning  untranslated  app.ok        Translation is identical to the source
  10:5  error    icu-syntax    cart.items    ICU syntax error: Unclosed '{'
  11:5  warning  punctuation   cart.welcome  Trailing punctuation differs: source ends with ".", translation with no punctuation
  -     error    missing       msg_many      Missing key (source: "{{count}} messages")
  7:5   error    extra         app.old       Key does not exist in the source

  7 errors, 2 warnings

1 file checked: 7 errors, 2 warnings
```

The translator workflow:

```sh
# 1. list what is missing, with the source text, as a small JSON file
i18n-diff export-missing locales/en.json locales/fr.json -o todo-fr.json

# 2. translate the values in todo-fr.json (by hand, in a CAT tool, ...)

# 3. put them back; inserting before existing members shows only added lines
i18n-diff merge locales/fr.json todo-fr.json --source locales/en.json

# 4. verify
i18n-diff check locales/en.json locales/fr.json
```

## Commands

### `check <source> <target...>`

Compares each target with the source and prints the problems. Exit code `1` when there are errors, `0` otherwise.

| Option | Meaning |
|---|---|
| `--format text\|json\|github\|markdown` | Output format; `markdown` produces a PR comment table (file, key, check, message). `github` prints workflow commands (`::error file=...`); missing keys are collapsed into one annotation per file. |
| `--max-issues <count>` | Maximum rows in Markdown output (default: 200). Further issues appear as `... and N more`; exit status still counts all issues. |
| `--ignore a,b` | Skip these checks (see the table below). |
| `--warnings-as-errors` | Exit `1` on warnings too. |
| `--allow-key <pattern>` | Key that may equal the source text. `*` and `?` are wildcards. Repeatable. |
| `--allow-value <text>` | Value that may equal the source text (brand names, `OK`). Repeatable. |
| `--locale <tag>` | Locale of the targets. By default it is detected from the file name (`fr.json`, `pt_BR.json`, `messages.de.json`) or the parent folder (`ja/common.json`). |
| `--source-locale <tag>` | Locale of the source, same detection. |
| `--config <file>` | Config file. Default: `.i18n-diff.json` in the working directory, if it exists. |

Targets may contain `*` or `?` in the file name (useful on Windows shells that do not expand globs). The source file is skipped if it matches.

### `export-missing <source> <target>`

Writes a minimal JSON containing the keys that still need a translation, with the source text as value, in source order. The target file may not exist yet (a new language).

| Option | Meaning |
|---|---|
| `-o, --output <file>` | Write to a file instead of stdout. |
| `--only-missing` | Leave out keys that exist but are empty. |
| `--include-untranslated` | Also list keys whose value equals the source. |
| `--shape auto\|nested\|flat` | Shape of the output. `auto` follows the source file. |

Plural forms the target language needs but the source does not have (for example `item_few` for Russian) are included with the source `_other` text.

### `merge <target> <filled>`

Inserts the translations from `filled` (nested or flat) into `target`.

- New keys are placed where they belong according to the source order. With `--source <file>` that order comes from the source; without it, the order of the filled file is used.
- Indentation (spaces or tabs), line endings (LF or CRLF), a missing trailing newline and a byte order mark are preserved. Existing lines are not re-formatted; inserting keys before existing members produces only added lines.
- When a key lands after the last entry of an object, that entry's line gains a comma.
- Empty values (`""` or `null`) in the target are filled in place. Existing non-empty translations are kept unless you pass `--overwrite`.
- With `--source`, keys that are not in the source are skipped (plural forms of known plural groups are accepted).
- A target that does not exist is created.

| Option | Meaning |
|---|---|
| `--source <file>` | Source file: fixes the key order and rejects unknown keys. |
| `--overwrite` | Replace existing non-empty translations too. |
| `--dry-run` | Print what would change, write nothing. |
| `-o, --output <file>` | Write the result to another file. |

### `stats <source> <target...>`

Completion per file.

```sh
node bin/i18n-diff.js stats test/fixtures/en.json test/fixtures/fr.json test/fixtures/ru.json
```

```text
File                   Locale  Translated  Missing  Empty  Untranslated  Extra  Complete
test/fixtures/fr.json  fr      9/12        2        1      1             1      75.0%
test/fixtures/ru.json  ru      13/13       0        0      0             0      100.0%
```

| Option | Meaning |
|---|---|
| `--format text\|json\|markdown` | Completion as a terminal table, JSON or a PR comment table. |
| `--sort completion` | Lowest completion first; ties sort by file name. Default: input order. |
| `--min <percent>` | Exit `1` if any file is below this threshold (0–100). Overrides all config thresholds. |

The config can set `minCompletion` per locale, with a `default` fallback. Completion counts non-empty translations; identical-to-source warnings are shown separately and still count as translated.

## Checks

| Check | Severity | What it finds |
|---|---|---|
| `missing` | error | A key of the source is absent from the target. |
| `extra` | error | A key of the target does not exist in the source. |
| `empty` | error | The translation is `""`, whitespace or `null`. |
| `placeholder` | error | The set of placeholders differs from the source: `{name}`, `{{name}}`, `$t(key)`, `@:key`, and arguments nested in ICU plural/select branches. Order is irrelevant. |
| `icu-syntax` | error | The translation is not valid ICU MessageFormat (unclosed brace, missing `other` branch, bad selector, ...). Not reported when the source itself does not parse. |
| `html-tag` | error | Tags differ from the source (`<b>`, `</b>`, `<br/>`, `<0>`). Attributes are ignored, so localised `href`s are fine. |
| `duplicate-key` | error | The same key appears twice in one object in the source or target. |
| `key-collision` | error | Distinct source or target paths flatten to the same dotted key. |
| `invalid-file` | error | The target is not valid JSON, or not an object. |
| `untranslated` | warning | The value is identical to the source. Skipped when both locales share the primary language (`en` and `en-GB`), for values without letters, and for allowlisted keys or values. |
| `punctuation` | warning | The trailing punctuation class differs (`.`, `!`, `?`, `:`, `;`, `,`, `...`). Full-width, Arabic and Devanagari marks count as their ASCII equivalent. |

### Plurals

Keys such as `item_one` / `item_other` are treated as a plural group when the source has an `_other` form plus at least one more form. The target is then expected to contain exactly the categories its language needs, taken from `Intl.PluralRules` (Russian: `one`, `few`, `many`, `other`; Japanese: `other`). The locale comes from the file name or `--locale`; if it cannot be determined, the forms of the source are expected. Ordinal groups (`key_ordinal_one`) use ordinal rules. In plural forms, placeholders may be dropped relative to the `_other` form (a "one" form often says "one item"), but unknown placeholders are still reported.

## Configuration

`.i18n-diff.json` (all fields optional):

```json
{
  "ignore": ["punctuation"],
  "allowKeys": ["brand.*", "*.url"],
  "allowValues": ["OK", "Email"],
  "sourceLocale": "en",
  "warningsAsErrors": false,
  "format": "text",
  "minCompletion": { "default": 90, "de": 100 }
}
```

Command line options add to the lists in the config file.

| Field | Type / behavior |
|---|---|
| `ignore`, `allowKeys`, `allowValues` | Arrays of strings; CLI lists are added. |
| `sourceLocale` | String, such as `en`. |
| `warningsAsErrors` | Boolean; default `false`. |
| `format` | Check output: `text` (default), `json`, `github`, `markdown`. |
| `minCompletion` | Object mapping detected locale tags to numeric percentages (0–100). Exact locale match, then `default`, then no gate. CLI `--min` overrides the whole map. |

Unknown fields and invalid types are input errors. `stats` uses `--format` independently of the configured check format.

## Usage examples

See [the runnable translator project](examples/README.md) for synthetic English, French, German and Russian locales, real command output and a CI snippet.

## GitHub Actions

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
- run: npx --package i18n-json-diff i18n-diff check locales/en.json 'locales/*.json' --format github
```

## Library use

```js
import { compareFiles, loadLocaleFile, mergeTranslations } from 'i18n-json-diff';

const source = loadLocaleFile('locales/en.json');
const target = loadLocaleFile('locales/fr.json');
const { issues, summary } = compareFiles(source, target);
```

Also exported: `parseLocaleText`, `exportMissing`, `parseIcu`, `analyze`, `extractTags`, `detectLocale`, `loadConfig`, `CHECKS`.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | No errors (and no warnings with `--warnings-as-errors`; completion above `--min`). |
| 1 | Problems found. |
| 2 | Usage error, unreadable or invalid source/filled file, bad config. |

## How it works

A position-aware JSON parser keeps each value's original byte range. Checks compare a flattened key map; merge patches only inserted members or replaced values, preserving indentation, line endings, BOM and existing text. Appending a member adds a comma to the previous last line; filling or overwriting a value modifies its line.

## FAQ / Limitations

**Why does the demo exit with code 1?** It contains intentionally broken translations. Use `--ignore` for checks you do not need; use `--warnings-as-errors` to make warnings fail CI too.

**Can brand names stay untranslated?** Yes. Add `allowKeys` or `allowValues` to the config, or use `--allow-key` / `--allow-value`.

**Does this translate messages automatically?** No. `export-missing` prepares source text for translation; `merge` inserts the completed translations.

**What formats and edge cases are supported?**

- JSON only. YAML, `.po`, `.properties` and JSON5 are unsupported. The first comment (`//` or `/*`) or trailing comma is named with its line and column in an `invalid-file` target issue; invalid source files raise `InputError`. Comment markers inside strings are allowed.
- ICU support covers the syntax and the argument names, not formatting. Unknown argument types are reported as syntax errors.
- Arrays are flattened with their index as the key (`list.0`). Literal dots are not escaped: `{"a.b":"x"}` and `{"a":{"b":"x"}}` both flatten to `a.b`. Across files these spellings match. Within either file they report `key-collision`; the flat map retains the last visited leaf value. Resolve collisions before export or merge.
- Duplicate keys are scoped to their containing object: `a.x` and `b.x` are distinct; repeated `x` inside `a` reports `duplicate-key`. Duplicate containers are reported too. The flat map retains the last visited value for repeated leaf paths; duplicate containers may leave earlier child paths in the map. Resolve duplicates before export or merge.
- Files are processed locally; the CLI makes no network requests and sends no translation data to external services.
- Punctuation and "untranslated" are heuristics, which is why they are warnings.

## Development

```sh
npm ci
npm run lint
npm test
npm run demo
npm run bench
npm pack --dry-run
```

`npm test` prints Node's built-in line, branch and function coverage report in the terminal and CI. This plain JavaScript project has no separate typecheck command; ESLint checks the source. CI checks Node 20, 22 and 24 on Windows and Linux. The benchmark generates 20,000 keys in memory and measures parsing/check and merge time.

`npm run demo` regenerates `docs/demo.svg` from the CLI entry point using the command above. CI runs `node scripts/make-demo.mjs --check` to catch stale images. The full output remains available as text in the Demo section.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) (c) 2026 Yusuf Berat Zengin
