# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-22

### Added

- `check` command with text, JSON and GitHub annotation output; exit code `1` on errors.
- Checks: `missing`, `extra`, `empty`, `placeholder`, `icu-syntax`, `html-tag`, `duplicate-key`, `invalid-file` (errors); `untranslated`, `punctuation` (warnings).
- Nested and flat JSON, i18next plural suffixes with per-language categories from `Intl.PluralRules`, `{{double}}` placeholders, `$t()` nesting, vue-i18n linked messages, and a small ICU MessageFormat tokenizer (plural, selectordinal, select, nested branches, apostrophe quoting).
- `export-missing` command: minimal JSON of keys to translate, with source values.
- `merge` command: inserts translations by patching the file text, preserving key order relative to the source, indentation, line endings, BOM and trailing newline.
- `stats` command with `--min` completion gate.
- Allowlists (`--allow-key`, `--allow-value`), `--ignore`, `--warnings-as-errors` and the `.i18n-diff.json` config file.
- Programmatic API.
