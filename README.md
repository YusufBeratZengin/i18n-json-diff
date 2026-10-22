# i18n-json-diff

[![CI](https://github.com/YusufBeratZengin/i18n-json-diff/actions/workflows/ci.yml/badge.svg)](https://github.com/YusufBeratZengin/i18n-json-diff/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Compare translation JSON files against a source locale. It reports missing, extra, empty and broken keys, and it helps translators fill the gaps without disturbing the file: `merge` inserts new translations as new lines and leaves everything else byte for byte as it was.

English | [Turkce](README.tr.md)

- Zero runtime dependencies, Node.js 20 or newer, ESM.
- Works with nested and flat JSON (vue-i18n, i18next, react-intl, Hoppscotch-style files).
- Understands i18next plural suffixes (`_one`, `_other`, `_few`, ...), ICU MessageFormat, `{{double}}` placeholders and HTML tags.
- Output as text, JSON, or GitHub Actions annotations.

## Install

```sh
npm install --save-dev i18n-json-diff
# or run it once
npx i18n-json-diff check locales/en.json locales/*.json
```

The package is not published to the npm registry yet; until then install from GitHub:
`npm install --save-dev github:YusufBeratZengin/i18n-json-diff`.

The command is `i18n-diff`.

## Quick start

```sh
i18n-diff check locales/en.json locales/fr.json locales/de.json
```

```
fr.json (fr)
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

# 3. put them back; the diff of locales/fr.json shows only added lines
i18n-diff merge locales/fr.json todo-fr.json --source locales/en.json

# 4. verify
i18n-diff check locales/en.json locales/fr.json
```

## Commands

### `check <source> <target...>`

Compares each target with the source and prints the problems. Exit code `1` when there are errors, `0` otherwise.

| Option | Meaning |
|---|---|
| `--format text\|json\|github` | Output format. `github` prints workflow commands (`::error file=...`); missing keys are collapsed into one annotation per file. |
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
- Indentation (spaces or tabs), line endings (LF or CRLF), a missing trailing newline and a byte order mark are preserved. Existing lines are not re-formatted, so `git diff` only shows added lines.
- The one unavoidable exception: when a key lands after the last entry of an object, that entry's line gains a comma.
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

```
File     Locale  Translated  Missing  Empty  Untranslated  Extra  Complete
fr.json  fr      9/12        2        1      1             1      75.0%
ru.json  ru      13/13       0        0      0             0      100.0%
```

`--format json` prints the same data as JSON. `--min <percent>` exits `1` when any file is below the threshold, which is handy as a CI gate.

## Checks

| Check | Severity | What it finds |
|---|---|---|
| `missing` | error | A key of the source is absent from the target. |
| `extra` | error | A key of the target does not exist in the source. |
| `empty` | error | The translation is `""`, whitespace or `null`. |
| `placeholder` | error | The set of placeholders differs from the source: `{name}`, `{{name}}`, `$t(key)`, `@:key`, and arguments nested in ICU plural/select branches. Order is irrelevant. |
| `icu-syntax` | error | The translation is not valid ICU MessageFormat (unclosed brace, missing `other` branch, bad selector, ...). Not reported when the source itself does not parse. |
| `html-tag` | error | Tags differ from the source (`<b>`, `</b>`, `<br/>`, `<0>`). Attributes are ignored, so localised `href`s are fine. |
| `duplicate-key` | error | The same key appears twice in the target file. |
| `invalid-file` | error | The target is not valid JSON, or not an object. |
| `untranslated` | warning | The value is identical to the source. Skipped when both locales share the primary language (`en` and `en-GB`), for values without letters, and for allowlisted keys or values. |
| `punctuation` | warning | The trailing punctuation class differs (`.`, `!`, `?`, `:`, `;`, `,`, `...`). Full-width, Arabic and Devanagari marks count as their ASCII equivalent. |

### Plurals

Keys such as `item_one` / `item_other` are treated as a plural group when the source has an `_other` form plus at least one more form. The target is then expected to contain exactly the categories its language needs, taken from `Intl.PluralRules` (Russian: `one`, `few`, `many`, `other`; Japanese: `other`). The locale comes from the file name or `--locale`; if it cannot be determined, the forms of the source are expected. Ordinal groups (`key_ordinal_one`) use ordinal rules. In plural forms, placeholders may be dropped relative to the `_other` form (a "one" form often says "one item"), but unknown placeholders are still reported.

## Config file

`.i18n-diff.json` (all fields optional):

```json
{
  "ignore": ["punctuation"],
  "allowKeys": ["brand.*", "*.url"],
  "allowValues": ["OK", "Email"],
  "sourceLocale": "en",
  "warningsAsErrors": false,
  "format": "text"
}
```

Command line options add to the lists in the config file.

## GitHub Actions

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
- run: npx i18n-diff check locales/en.json 'locales/*.json' --format github
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

## Limitations

- JSON only. YAML, `.po`, `.properties` and JSON5 (comments, trailing commas) are not supported.
- ICU support covers the syntax and the argument names, not formatting. Unknown argument types are reported as syntax errors.
- Arrays are flattened with their index as the key (`list.0`).
- Punctuation and "untranslated" are heuristics, which is why they are warnings.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) (c) 2026 Yusuf Berat Zengin
