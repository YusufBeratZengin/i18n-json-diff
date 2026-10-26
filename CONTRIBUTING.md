# Contributing

English | [Türkçe](CONTRIBUTING.tr.md)

Thanks for helping. This project is small on purpose: zero runtime dependencies, Node.js 20 or newer, plain ESM.

## Setup

```sh
git clone https://github.com/YusufBeratZengin/i18n-json-diff.git
cd i18n-json-diff
npm ci
npm test
npm run lint
```

`npm test` also prints Node's built-in line, branch and function coverage report.
Review uncovered production code and add behavior-focused tests when line coverage
falls below 85%. There is no separate typecheck command in this plain JavaScript project.

When changing CLI output or the demo fixtures, run `npm run demo` and update both
README output blocks. `node scripts/make-demo.mjs --check` verifies the SVG is current.

## Layout

| Path | Purpose |
|---|---|
| `src/json-ast.js` | Position-aware JSON parser (offsets are what make byte-minimal merges possible). |
| `src/files.js` | Loads a locale file into a flat key view plus the AST. |
| `src/icu.js`, `src/messages.js` | ICU tokenizer, placeholder, HTML tag and punctuation helpers. |
| `src/locale.js`, `src/plural.js` | Locale detection, BCP 47 canonicalization and plural category helpers. |
| `src/compare.js` | The checks. |
| `src/config.js` | Configuration file loading and schema validation. |
| `src/merge.js`, `src/export.js` | `merge` and `export-missing`. |
| `src/cli.js`, `src/report.js` | Command line, output formats. |
| `examples/` | Synthetic sample project with CLI workflow, CI configuration and programmatic API example. |
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
- `npm test` and `npm run lint` must pass; CI runs both on Ubuntu and Windows with Node 20, 22 and 24.

## Releasing

The maintainer publishes through `.github/workflows/release.yml`, triggered by tags matching `v*.*.*`.
Before the first automated release, configure an npm trusted publisher for owner `YusufBeratZengin`,
repository `i18n-json-diff`, workflow `release.yml` and environment `npm`. Create the matching GitHub
environment. The workflow uses Node 24 and npm 11.5.1 or newer for OIDC, with `contents: read`
and `id-token: write`; no registry token is stored. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
If the package does not exist on npm yet, its first publication and trusted-publisher setup are a
maintainer prerequisite; do not add a token fallback to the workflow.

1. Move the intended CHANGELOG entries from Unreleased to a dated release section.
2. Bump `package.json` and the lockfile together, following SemVer.
3. Run `npm ci`, `npm run lint`, `npm test` and `npm pack --dry-run`; review the package file list.
4. Commit the reviewed release as `chore(release): vX.Y.Z` and create the matching tag.
5. The maintainer pushes the approved commit and tag. The workflow verifies the version, repeats
   the checks, then runs `npm publish --provenance --access public`. Monitor the workflow and
   verify the published package and provenance on npm.

Keep the release unpublished until the trusted publisher is configured. For local performance
sanity checks, `npm run bench` measures a synthetic 20,000-key check and merge without disk I/O.

## Reporting bugs

Open an issue with the smallest source and target JSON that reproduces the problem, the command you ran and the output you expected. Do not paste real customer data or secrets.
