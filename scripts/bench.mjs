import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { compareFiles, mergeTranslations, parseLocaleText } from '../src/index.js';

export function benchmark(size = 20_000) {
  const sourceData = {};
  const targetData = {};
  const filledData = {};
  const completeData = {};
  for (let n = 0; n < size; n++) {
    const key = `message_${String(n).padStart(5, '0')}`;
    sourceData[key] = `Message ${n}: {name}`;
    completeData[key] = `Nachricht ${n}: {name}`;
    // 100 missing keys spread throughout the file, always before a surviving line.
    if (n % 200 === 0) filledData[key] = completeData[key];
    else targetData[key] = completeData[key];
  }
  const sourceText = `${JSON.stringify(sourceData, null, 2)}\n`;
  const targetText = `${JSON.stringify(targetData, null, 2)}\n`;
  const start = performance.now();
  const source = parseLocaleText(sourceText, 'en.json');
  const target = parseLocaleText(targetText, 'de.json');
  const checked = compareFiles(source, target);
  const checkMs = performance.now() - start;
  const filled = parseLocaleText(JSON.stringify(filledData), 'de.json');
  const mergeStart = performance.now();
  const merged = mergeTranslations(target, filled, { source });
  const mergeMs = performance.now() - mergeStart;
  return { size, checkMs, mergeMs, checked, merged, targetText,
    expectedText: `${JSON.stringify(completeData, null, 2)}\n` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { size, checkMs, mergeMs, merged } = benchmark();
  console.log(`${size} keys: check (including parse) ${checkMs.toFixed(1)} ms; merge ${mergeMs.toFixed(1)} ms; added ${merged.added.length}`);
}
