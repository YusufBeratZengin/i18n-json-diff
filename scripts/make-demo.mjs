import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { run } from '../src/cli.js';

// Use the same CLI entry point as bin/i18n-diff.js, with synthetic fixtures.
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const args = ['check', 'test/fixtures/en.json', 'test/fixtures/fr.json'];
const command = `node bin/i18n-diff.js ${args.join(' ')}`;
let stdout = '';
let stderr = '';
const status = run(args, {
  stdout: (text) => { stdout += text; },
  stderr: (text) => { stderr += text; },
}, root);
if (status !== 1 || stderr || !stdout.trim()) {
  throw new Error(`Demo expected translation errors (exit 1), got ${status}: ${stderr}`);
}

const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
// Wrap long terminal rows without dropping or changing the captured output.
const lines = [`$ ${command}`, '', ...stdout.trimEnd().split(/\r?\n/)];
const wrapped = lines.flatMap((line) => {
  const rows = [];
  while (line.length > 105) {
    const split = line.lastIndexOf(' ', 105);
    const end = split > 20 ? split : 105;
    rows.push(line.slice(0, end));
    line = `    ${line.slice(end).trimStart()}`;
  }
  return [...rows, line];
});
const width = 1100;
const height = 96 + wrapped.length * 23;
const rows = wrapped.map((line, index) => {
  const color = index === 0 ? '#7ee7c5' : /warning/.test(line) ? '#f2cc60' : '#e6edf3';
  return `    <text x="28" y="${85 + index * 23}" fill="${color}">${escape(line)}</text>`;
}).join('\n');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">i18n-json-diff terminal demo</title>
  <desc id="description">A real check of synthetic French translations: 7 errors and 2 warnings. The full command and output are also available as text in the README.</desc>
  <rect width="${width}" height="${height}" rx="16" fill="#0d1117"/>
  <path d="M16 0h${width - 32}a16 16 0 0 1 16 16v32H0V16A16 16 0 0 1 16 0" fill="#21262d"/>
  <circle cx="28" cy="24" r="6" fill="#ff5f57"/>
  <circle cx="50" cy="24" r="6" fill="#febc2e"/>
  <circle cx="72" cy="24" r="6" fill="#28c840"/>
  <text x="550" y="29" text-anchor="middle" fill="#a5b0be" font-family="monospace" font-size="13">i18n-json-diff · check</text>
  <g font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="16" xml:space="preserve">
${rows}
  </g>
</svg>
`;
const output = new URL('../docs/demo.svg', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== svg) throw new Error('Demo is stale; run npm run demo.');
  console.log(`Demo is current (${wrapped.length} terminal lines).`);
} else {
  mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
  writeFileSync(output, svg);
  console.log(`Generated docs/demo.svg from real CLI output (${wrapped.length} terminal lines, exit ${status}).`);
}
