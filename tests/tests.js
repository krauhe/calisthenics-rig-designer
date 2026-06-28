// Tests for regnekernen. Framework-uafhængige: returnerer et resultatobjekt,
// så de kan køres i browseren (run-tests.html) ELLER med bare Node
// (node-run.mjs) — uden Vitest/npm-install.
//
// Vigtigt: referenceværdierne er UAFHÆNGIGT håndregnede (lukkede formler),
// ikke blot et snapshot af hvad koden tilfældigvis giver — så testene kan
// fange en fejl, ikke kun en utilsigtet ændring. Rør-/fundamenttallene er
// desuden krydstjekket mod den nuværende apps viste værdier (parity).

import { lenToSI, lenFromSI, dimToMM, dimFromMM } from '../src/core/units.js';
import { sectionProps } from '../src/core/sections.js';
import { beam } from '../src/core/mechanics.js';
import { foundation } from '../src/core/foundation.js';
import { packPieces } from '../src/core/cutplan.js';
import { CATALOG, findMaterial } from '../src/core/materials.js';

export function runTests() {
  const results = [];
  const ok = (name, cond, msg = '') => results.push({ name, ok: !!cond, msg });
  const approx = (a, b, rel = 1e-3) => Math.abs(a - b) <= Math.abs(b) * rel + 1e-12;
  const near = (name, a, b, rel = 1e-3) =>
    ok(name, approx(a, b, rel), `fik ${a}, forventede ≈ ${b}`);

  // ---- units: eksakte faktorer + round-trip ----
  near('ft→m (1 ft = 0,3048 m)', lenToSI(1, 'ft'), 0.3048, 1e-9);
  near('m→ft round-trip (3,5)', lenFromSI(lenToSI(3.5, 'ft'), 'ft'), 3.5, 1e-12);
  near('in→mm (1″ = 25,4 mm)', dimToMM(1, 'in'), 25.4, 1e-9);
  near('1,25″ → 31,75 mm', dimToMM(1.25, 'in'), 31.75, 1e-9);
  near('mm→in round-trip (42,4)', dimFromMM(dimToMM(42.4, 'in'), 'in'), 42.4, 1e-12);
  ok('m passthrough uændret', lenToSI(2.4, 'm') === 2.4);

  // ---- sections: træ 100 mm (eksakte lukkede formler I=b⁴/12, Z=b³/6) ----
  const w = sectionProps({ kind: 'wood', side: 100 });
  near('træ 100mm I = 8,333e-6', w.I, 8.3333333e-6, 1e-5);
  near('træ 100mm Z = 1,667e-4', w.Z, 1.6666667e-4, 1e-5);
  near('træ 100mm A = 0,01', w.A, 0.01, 1e-9);

  // ---- sections: 1" rør, hult cirkulært (uafhængigt udregnet) ----
  const p = sectionProps({ kind: 'pipe', od: 33.7, wall: 3.2 });
  near('rør 1" I ≈ 3,605e-8', p.I, 3.6047e-8, 3e-3);
  near('rør 1" Z ≈ 2,139e-6', p.Z, 2.1393e-6, 3e-3);

  // ---- katalog: dokumenterede ydre-diametre ----
  ok('katalog 3/4" od = 26,9', findMaterial('pipe-3-4').od === 26.9);
  ok('katalog 1" od = 33,7', findMaterial('pipe-1').od === 33.7);
  ok('katalog 1¼" od = 42,4', findMaterial('pipe-1-4').od === 42.4);
  ok('katalog 10×10 træ side = 100', findMaterial('wood-10').side === 100);

  // ---- beam: træ, rene tal (L=2 m, 100 kg, fixity 0,25) ----
  const bw = beam(2.0, { kind: 'wood', side: 100, E: 10e9, sRe: 10e6, sRm: 24e6 }, 100, 0.25);
  near('beam cReal = 0,21875', bw.cReal, 0.21875, 1e-9);
  near('beam træ dPin = 1,962 mm', bw.dPin * 1000, 1.962, 5e-3);
  near('beam træ dReal = 1,594 mm', bw.dReal * 1000, 1.5941, 5e-3);
  near('beam træ pYield = 388,3 kg', bw.pYield, 388.3, 5e-3);
  near('beam træ pUlt = 931,9 kg', bw.pUlt, 931.9, 5e-3);

  // ---- beam: 1" rør (L=2,4 m, 120 kg) — parity m. nuværende app ----
  const bp = beam(2.4, findMaterial('pipe-1'), 120, 0.25);
  near('beam rør dReal = 36,39 mm', bp.dReal * 1000, 36.39, 5e-3);
  near('beam rør pYield = 81,0 kg', bp.pYield, 81.0, 8e-3);
  near('beam rør pUlt = 132,9 kg', bp.pUlt, 132.9, 8e-3);

  // ---- foundation: parity m. nuværende postSpec (0,125 m stolpe) ----
  const f = foundation({ postSide: 0.125, depth: 1.20, hole: 0.30, topHeight: 2.7 });
  near('fund Kθ = 3456 kNm/rad', f.Ktheta / 1000, 3456, 2e-3);
  near('fund dTop = 16,85 mm', f.dTop * 1000, 16.85, 5e-3);
  near('fund kLat = 29,1 N/mm', f.kLat / 1000, 29.1, 5e-3);

  // ---- foundation: dybere hul ⇒ stivere (monotoni-tjek) ----
  const fDeep = foundation({ postSide: 0.125, depth: 1.60, hole: 0.30, topHeight: 2.7 });
  ok('dybere fundament ⇒ stivere', fDeep.kLat > f.kLat);

  // ---- cutplan: FFD med 4 mm savsnit ----
  const cp = packPieces(
    [{ len: 2.4, label: 'A' }, { len: 2.4, label: 'C' },
     { len: 1.2, label: 'B' }, { len: 1.2, label: 'D' }],
    6.0, 0.004);
  ok('cutplan: 2 stænger', cp.count === 2);
  ok('cutplan: alle 4 stykker placeret',
     cp.bars.reduce((n, b) => n + b.pieces.length, 0) === 4);
  ok('cutplan: ingen stang overfyldt',
     cp.bars.every(b => b.used <= 6.0 + 1e-9));

  const passed = results.filter(r => r.ok).length;
  return { passed, failed: results.length - passed, results };
}
