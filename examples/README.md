# Cloud Garden translator workflow

English | [Türkçe](README.tr.md)

All strings in this example describe a fictional garden interface. No external
service is contacted. Start from the repository root, then run `cd examples`.
These commands use the local CLI, so no package installation is needed.
Copy `examples/` before experimenting if you want to keep the starting fixtures.

## Export the missing strings

```sh
node ../bin/i18n-diff.js export-missing locales/en.json locales/fr.json -o todo-fr.json
```

```text
Wrote 2 keys to todo-fr.json
```

The generated file contains:

```json
{
  "greeting": "Hello, {name}!",
  "hint": "Choose a <b>seed</b>."
}
```

## Translate and merge

Translate those two values in `todo-fr.json`, preserving the placeholder and tags.
The ready-to-use translation is also provided in `filled-fr.json`:

```json
{
  "greeting": "Bonjour, {name} !",
  "hint": "Choisissez une <b>graine</b>."
}
```

```sh
node ../bin/i18n-diff.js merge locales/fr.json todo-fr.json --source locales/en.json
```

```text
Merged into locales/fr.json
added 2, filled 0, overwritten 0, kept 0, skipped 0
```

Both new lines land before an existing member. Every original line is preserved;
the line diff has two additions and zero deletions. Filling an existing empty
value or adding a key at the end of an object can also modify an existing line.

## Check the result

```sh
node ../bin/i18n-diff.js check locales/en.json locales/fr.json
```

```text
locales/fr.json (fr)
  OK

1 file checked: 0 errors, 0 warnings
```

## Track completion

```sh
node ../bin/i18n-diff.js stats locales/en.json locales/fr.json locales/de.json locales/ru.json --format markdown --sort completion
```

```text
| File | Locale | Translated | Missing | Empty | Untranslated | Extra | Complete |
| --- | --- | --- | --- | --- | --- | --- | --- |
| locales/de.json | de | 6/6 | 0 | 0 | 0 | 0 | 100.0% |
| locales/fr.json | fr | 7/7 | 0 | 0 | 0 | 0 | 100.0% |
| locales/ru.json | ru | 8/8 | 0 | 0 | 0 | 0 | 100.0% |
```

French and Russian need more plural categories than English. The local
`.i18n-diff.json` enables strict warnings and completion gates (90% by default,
100% for German); `--min` can override all configured gates for a run.

## CI

See [github-actions.yml](github-actions.yml) for a consuming project's workflow.
It assumes the project has this package installed as a dev dependency and a
lockfile. The snippet checks the project's `locales/` directory; when adapting
it for this repository, use `examples/locales/` and the local `bin/i18n-diff.js`.

## Programmatic API

Run the library example from this directory:

```sh
node api.mjs
```
