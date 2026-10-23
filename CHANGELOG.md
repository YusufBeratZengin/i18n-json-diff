# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- A reproducible terminal SVG demo captured from the real CLI, embedded in both READMEs, with a CI freshness check.
- Built-in Node.js test coverage reporting in local and CI test output, without additional dependencies.
- Weekly CodeQL JavaScript analysis on pushes and pull requests.
- Markdown check reports with a default 200-issue limit and `--max-issues` override; omitted issues still affect exit status.
- Markdown stats, ascending `--sort completion` and validated per-locale `minCompletion` config thresholds; CLI `--min` overrides the map.
- `key-collision` errors for ambiguous dotted paths in source and target files, plus nested duplicate/container-key coverage and documented flattening behavior.
- A synthetic four-locale example project with config, GitHub Actions snippet, real translator-workflow output and an additions-only merge regression test.
- An in-memory 20,000-key benchmark and a regression test for the 3-second check budget and byte-minimal merge.
- Public/provenance npm publish configuration, prepublish lint/test checks, tag-triggered OIDC release workflow and maintainer release instructions.
- Bug and feature issue forms, PR template, Contributor Covenant 2.1 and weekly npm dev-dependency / GitHub Actions updates.

### Changed

- CI now explicitly uses read-only contents permission and covers Node 20, 22 and 24 on Windows and Linux, including package dry-run checks.
- File errors use plain language for missing files, directories and denied access; JSON errors include line and column, and identify the first unsupported comment or trailing comma. Existing exit codes are preserved.
- English and Turkish READMEs now share all sections, demo and stats output, API export list and ordinal-plural guidance; include runtime/dependency badges, config schema and runnable examples.
- Both READMEs open with a short pitch, three reasons to use the tool, a checkout-based quick start and practical FAQ entries; Turkish demo code fences are corrected.

### Fixed

- GitHub annotation paths now use forward slashes and become relative when inside the working directory, including Windows paths.
- Corrected the Turkish language link to `Türkçe`.
- Source duplicate keys are now reported as well as target duplicate keys.

## [0.1.0] - 2026-10-23

### Added

- `check` command with text, JSON and GitHub annotation output; exit code `1` on errors.
- Checks: `missing`, `extra`, `empty`, `placeholder`, `icu-syntax`, `html-tag`, `duplicate-key`, `invalid-file` (errors); `untranslated`, `punctuation` (warnings).
- Nested and flat JSON, i18next plural suffixes with per-language categories from `Intl.PluralRules`, `{{double}}` placeholders, `$t()` nesting, vue-i18n linked messages, and a small ICU MessageFormat tokenizer (plural, selectordinal, select, nested branches, apostrophe quoting).
- `export-missing` command: minimal JSON of keys to translate, with source values.
- `merge` command: inserts translations by patching the file text, preserving key order relative to the source, indentation, line endings, BOM and trailing newline.
- `stats` command with `--min` completion gate.
- Allowlists (`--allow-key`, `--allow-value`), `--ignore`, `--warnings-as-errors` and the `.i18n-diff.json` config file.
- Programmatic API.
