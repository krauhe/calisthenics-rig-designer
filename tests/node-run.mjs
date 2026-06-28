// Kør regnekerne-testene med bare Node (ingen Vitest/npm-install nødvendig):
//   node tests/node-run.mjs
// Bruges også af "npm test". Afslutter med kode 1 hvis noget fejler.

import { runTests } from './tests.js';

const r = runTests();
for (const t of r.results) {
  console.log((t.ok ? 'PASS' : 'FAIL') + '  ' + t.name + (t.ok ? '' : '   — ' + t.msg));
}
console.log(`\n${r.passed}/${r.passed + r.failed} bestået`);
process.exit(r.failed === 0 ? 0 : 1);
