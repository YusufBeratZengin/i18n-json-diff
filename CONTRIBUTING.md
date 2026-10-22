# Contributing

Thanks for helping. This project is small on purpose: zero runtime dependencies, Node.js 20 or newer, plain ESM.

## Setup

```sh
git clone https://github.com/YusufBeratZengin/i18n-json-diff.git
cd i18n-json-diff
npm install
npm test
npm run lint
```

## Layout

| Path | Purpose |
|---|---|
| `src/json-ast.js` | Position-aware JSON parser (offsets are what make byte-minimal merges possible). |
| `src/files.js` | Loads a locale file into a flat key view plus the AST. |
| `src/icu.js`, `src/messages.js` | ICU tokenizer, placeholder, HTML tag and punctuation helpers. |
| `src/compare.js` | The checks. |
| `src/merge.js`, `src/export.js` | `merge` and `export-missing`. |
| `src/cli.js`, `src/report.js` | Command line, output formats. |
| `test/` | `node:test` tests; `test/fixtures/` holds sample locale files. |

## Guidelines

- Use the built-in test runner (`node --test`). Every check needs a test, and a bug fix needs a test that fails without the fix.
- Anything that touches `merge` must keep the guarantee that existing lines are left untouched. Add a case to `test/merge.test.js` that asserts on the line diff.
- No runtime dependencies. Dev dependencies are fine.
- Keep user-facing messages short and specific: say what is wrong and with which key.
- New check codes need a severity in `src/compare.js`, a row in both READMEs and a CHANGELOG entry.

## Commits and pull requests

- Small commits with [Conventional Commits](https://www.conventionalcommits.org/) messages: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`.
- Describe what changed and why. Link the issue if there is one.
- `npm test` and `npm run lint` must pass; CI runs both on Ubuntu and Windows with Node 20 and 22.

## Reporting bugs

Open an issue with the smallest source and target JSON that reproduces the problem, the command you ran and the output you expected. Do not paste real customer data or secrets.
