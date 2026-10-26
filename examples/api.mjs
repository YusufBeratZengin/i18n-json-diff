/**
 * Example demonstrating programmatic use of i18n-json-diff as a library.
 * Run with: node examples/api.mjs
 */
import { fileURLToPath } from 'node:url';
import {
  compareFiles,
  exportMissing,
  loadLocaleFile,
  mergeTranslations,
  parseLocaleText,
} from 'i18n-json-diff';

const enPath = fileURLToPath(new URL('./locales/en.json', import.meta.url));
const frPath = fileURLToPath(new URL('./locales/fr.json', import.meta.url));

// 1. Load source and target locale files
const source = loadLocaleFile(enPath);
const target = loadLocaleFile(frPath);

// 2. Compare translations
const { issues, summary } = compareFiles(source, target);
console.log(`Completion: ${summary.percent}% (${summary.translated}/${summary.expected})`);
console.log(`Issues found: ${issues.length}`);
for (const issue of issues) {
  console.log(`  - [${issue.severity}] ${issue.key}: ${issue.message}`);
}

// 3. Export missing translations for translators
const todo = exportMissing(source, target);
console.log(`\nExported ${todo.count} missing keys:`);
console.log(todo.text.trim());

// 4. Merge completed translations back into the target file
const completedJson = JSON.stringify({
  greeting: 'Bonjour, {name} !',
  hint: 'Choisissez une <b>graine</b>.',
}, null, 2);
const filled = parseLocaleText(completedJson, '<translations>');
const merged = mergeTranslations(target, filled, { source });

console.log(`\nMerge summary: added ${merged.added.length}, filled ${merged.filled.length}`);
console.log('\nMerged output preview:');
console.log(merged.text.trim());
