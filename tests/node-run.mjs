// Kør regnekerne-testene med bare Node (ingen Vitest/npm-install nødvendig):
//   node tests/node-run.mjs
// Bruges også af "npm test". Afslutter med kode 1 hvis noget fejler.
//
// Kernen er klassiske scripts (globals, ingen ESM) — samme princip som
// index.html og build.py: filerne konkateneres i afhængigheds-rækkefølge og
// køres i én vm-kontekst, hvorefter runTests() kaldes derinde.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Kernefiler i afhængigheds-rækkefølge (delmængde af build.py's ORDER —
// kun regnekernen; UI/DOM-filer hører ikke til her).
const CORE = [
  'src/core/constants.js',
  'src/core/units.js',
  'src/core/sections.js',
  'src/core/mechanics.js',
  'src/core/foundation.js',
  'src/core/cutplan.js',
  'src/core/materials.js',
  'src/core/model.js',
  'src/core/presets.js',
  'src/core/schema.js',
];

const source = [...CORE, 'tests/tests.js']
  .map(f => `// ===== ${f} =====\n` + readFileSync(join(root, f), 'utf-8'))
  .join('\n\n');

const context = vm.createContext({ console });
vm.runInContext(source + '\n;__result = runTests();', context, { filename: 'core+tests.js' });
const r = context.__result;

for (const t of r.results) {
  console.log((t.ok ? 'PASS' : 'FAIL') + '  ' + t.name + (t.ok ? '' : '   — ' + t.msg));
}
console.log(`\n${r.passed}/${r.passed + r.failed} bestået`);
process.exit(r.failed === 0 ? 0 : 1);
