// Tests for regnekernen. Framework-uafhængige: definerer en global runTests(),
// så de kan køres i browseren (run-tests.html, klassiske script-tags) ELLER
// med bare Node (node-run.mjs, der kører kernefilerne i en vm-kontekst).
//
// Vigtigt: referenceværdierne er UAFHÆNGIGT håndregnede (lukkede formler),
// ikke blot et snapshot af hvad koden tilfældigvis giver — så testene kan
// fange en fejl, ikke kun en utilsigtet ændring. Rør-/fundamenttallene er
// desuden krydstjekket mod den nuværende apps viste værdier (parity).
//
// Kernen er klassiske scripts (ingen ESM) — testene forudsætter at
// constants/units/sections/mechanics/foundation/cutplan/materials/model/
// presets/schema er indlæst som globals FØR denne fil.

function runTests() {
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

  // ---- katalog: dokumenterede dimensioner OG godstykkelser ----
  ok('katalog 3/4" od = 26,9', findMaterial('pipe-3-4').od === 26.9);
  ok('katalog 3/4" gods = 2,6 (EN 10255 medium)', findMaterial('pipe-3-4').wall === 2.6);
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

  // ---- schema/fill: global rør-godstykkelse må IKKE overskrive katalogværdien ----
  {
    const d = deserialize(serialize(defaultDesign()));
    const p34 = d.library.find(m => m.id === 'pipe-3-4');
    ok('fill bevarer 3/4"-gods (2,6 mm)', p34 && p34.wall === 2.6);
    const p1 = d.library.find(m => m.id === 'pipe-1');
    ok('fill bevarer 1"-gods (3,2 mm)', p1 && p1.wall === 3.2);
    // rør UDEN eget gods udfyldes fra site.pipeWall_mm
    const d2 = fill({ schemaVersion: 1, library: [{ id: 'u1', kind: 'pipe', od: 40, E: 210e9, sRe: 195e6, sRm: 320e6 }] });
    const u1 = d2.library.find(m => m.id === 'u1');
    ok('fill udfylder manglende gods fra reserve-antagelsen', u1 && u1.wall === d2.site.pipeWall_mm);
  }

  // ---- foundation: parity m. nuværende postSpec (0,125 m stolpe) ----
  // Kθ = k·(b·D³/3 + b⁴/12) = 20e6·(0,3·1,728/3 + 0,0081/12) = 3 469 500 Nm/rad.
  // (Ældre reference 3456 medregnede kun side-leddet og var forældet.)
  const f = foundation({ postSide: 0.125, depth: 1.20, hole: 0.30, topHeight: 2.7 });
  near('fund Kθ = 3469,5 kNm/rad', f.Ktheta / 1000, 3469.5, 2e-3);
  near('fund dTop = 16,85 mm', f.dTop * 1000, 16.85, 5e-3);
  near('fund kLat = 29,1 N/mm', f.kLat / 1000, 29.1, 5e-3);

  // ---- foundation: dybere hul ⇒ stivere (monotoni-tjek) ----
  const fDeep = foundation({ postSide: 0.125, depth: 1.60, hole: 0.30, topHeight: 2.7 });
  ok('dybere fundament ⇒ stivere', fDeep.kLat > f.kLat);

  // ---- foundation: jordtype-faktor skalerer stivheden rigtigt ----
  {
    const soft = foundation({ postSide: 0.125, depth: 1.2, hole: 0.3, topHeight: 2.7, kSoil: K_SOIL * SOIL_FACTORS.soft });
    const firm = foundation({ postSide: 0.125, depth: 1.2, hole: 0.3, topHeight: 2.7, kSoil: K_SOIL * SOIL_FACTORS.firm });
    ok('blød jord ⇒ mere sving end fast', soft.dTop > f.dTop && firm.dTop < f.dTop);
    near('Kθ skalerer lineært med jordfaktor', soft.Ktheta, f.Ktheta * SOIL_FACTORS.soft, 1e-9);
    ok('soilFactorOf: default/normal/ukendt', soilFactorOf({}) === 1 && soilFactorOf({ site: { soil: 'kaboom' } }) === 1
      && soilFactorOf({ site: { soil: 'soft' } }) === SOIL_FACTORS.soft);
  }

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
  // kant-tilfælde: stykke længere end stangen → placeres alligevel, rest aldrig negativ
  const cpLong = packPieces([{ len: 7.5, label: 'X' }], 6.0, 0.004);
  ok('cutplan: overlangt stykke placeres', cpLong.count === 1 && cpLong.bars[0].pieces.length === 1);
  ok('cutplan: rest aldrig negativ', cpLong.bars[0].waste >= 0);
  ok('cutplan: tom liste → 0 stænger', packPieces([], 6.0, 0.004).count === 0);

  // ---- schema: round-trip + validering + migrering ----
  const dd = defaultDesign();
  const rt = deserialize(serialize(dd));
  ok('schema round-trip: sprog bevaret', rt.settings.lang === dd.settings.lang);
  ok('schema round-trip: bibliotek bevaret', rt.library.length === dd.library.length);
  ok('schema validate(default) = sandt', validate(dd) === true);
  ok('schema validate(junk) = falsk', validate({}) === false);
  let refused = false;
  try { deserialize(JSON.stringify({ schemaVersion: 99 })); } catch (e) { refused = true; }
  ok('schema afviser nyere version', refused);

  // ---- schema/fill: robusthed mod halvkorrupte filer (må ikke give NaN/crash) ----
  {
    const d = fill({ schemaVersion: 1, library: [{}], posts: [null, { id: 'p1', x_m: 'NaN-agtig', z_m: 2 }, { id: 'p2', x_m: 1, z_m: 2 }], connections: [{ id: 'c1', a: 'p1', b: 'p2' }], stock: '6', defaults: { post: { hole_mm: 50 } } });
    ok('fill: tomt/ugyldigt bibliotek → katalog', d.library.length >= CATALOG.length && d.library.every(m => m.kind === 'wood' ? m.side > 0 : m.od > 0));
    ok('fill: stolper uden tal-koordinater smides ud', d.posts.length === 1 && d.posts[0].id === 'p2');
    ok('fill: forbindelser til slettede stolper smides ud', d.connections.length === 0);
    ok('fill: stock af forkert type → {}', typeof d.stock === 'object' && !Array.isArray(d.stock));
    ok('fill: hul ≥ stolpens sidemål', d.defaults.post.hole_mm >= 125);
    ok('fill-resultat er gyldigt', validate(d) === true);
  }

  // ---- legacy-import (gammelt fast-firkant format) ----
  const leg = fromLegacy({ lenLong: 2.4, lenShort: 1.2, sideSizes: [0, 1, 2, 3],
    heights: [3.1, 2.3, 1.5, 1.0], depth: 1.2, hole: 0.3, load: 120, ladderWidth: 0.5 });
  ok('legacy: 4 stolper', leg.posts.length === 4);
  ok('legacy: 4 forbindelser', leg.connections.length === 4);
  ok('legacy: side A → 3/4"', leg.connections[0].material.id === 'pipe-3-4');
  ok('legacy: side D → 10×10 træ', leg.connections[3].material.id === 'wood-10');
  ok('legacy: bar ≥ 3,0 m lægges ovenpå', leg.connections[0].onTop === true);
  ok('legacy: stige-attachment', leg.attachments.length === 1 && leg.attachments[0].type === 'ladder');
  ok('legacy: gyldigt design', validate(leg) === true);

  // ---- presets: alle forslag skal bygge gyldige designs ----
  presetList().forEach(pr => {
    const d = buildPreset(pr.id);
    ok(`preset ${pr.id}: gyldigt design`, validate(d) === true);
    ok(`preset ${pr.id}: overlever fill()`, validate(fill(JSON.parse(JSON.stringify(d)))) === true);
  });

  // ---- labels: stolpe-bogstaver, forbindelses- og attachment-labels ----
  ok('letterFor: A, Z, #27', letterFor(0) === 'A' && letterFor(25) === 'Z' && letterFor(26) === '#27');
  {
    const d = buildPreset('long6');
    ok('connLabelOf: sorteret par', connLabelOf(d, d.connections[0]) === 'A–B');
    const monkeys = d.attachments.filter(a => a.type === 'monkey');
    ok('monkeyLabelOf: M1, M2', monkeyLabelOf(d, monkeys[0]) === 'M1' && monkeyLabelOf(d, monkeys[1]) === 'M2');
    const lad = d.attachments.find(a => a.type === 'ladder');
    ok('ladderLabelOf: S1', ladderLabelOf(d, lad) === 'S1');
  }

  // ---- armgang: geometri, validering og maks-højde ----
  {
    const d = buildPreset('long6');   // to armgange mellem parallelle skinner, gap 0,8 m
    const at = d.attachments.find(a => a.type === 'monkey');
    const g = monkeyGeometry(d, at.connA, at.connB, at.spacing_m);
    ok('monkey: geometri findes', !!g && g.rungs.length === g.count);
    near('monkey: trinlængde = bar-afstand (0,8 m)', g.rungLen, 0.8, 1e-6);
    ok('monkey: parallelle barer (cross = 0)', g.cross <= 1e-9);
    ok('monkey: gyldig placering', monkeyPlacementValid(g) === true);
    // trin ligger inden for overlappet med 12 cm endemargin
    const sp = at.spacing_m || 0.33;
    ok('monkey: trin med korrekt afstand', g.count >= 2
      && approx(Math.hypot(g.rungs[1].ax - g.rungs[0].ax, g.rungs[1].az - g.rungs[0].az), sp, 1e-6));
    // grebshøjde = laveste bar
    const ca = d.connections.find(c => c.id === at.connA), cb = d.connections.find(c => c.id === at.connB);
    near('monkey: grebshøjde = laveste bar', g.y, Math.min(ca.height_m, cb.height_m), 1e-9);
    // maks-højde = laveste af de 4 bærende stolper
    near('monkeyMaxHeight = laveste stolpe (2,5)', monkeyMaxHeight(d, at), 2.5, 1e-9);
    d.posts[0].height_m = 1.9;
    near('monkeyMaxHeight følger sænket stolpe', monkeyMaxHeight(d, at), 1.9, 1e-9);
    ok('monkeyMaxHeight: ukendt bar → null', monkeyMaxHeight(d, { connA: 'findes-ikke', connB: at.connB }) === null);
    ok('monkey: parallelle barer er ikke "roteret"', g.angled === false);
    ok('monkey: parallelle trin har ens længde', g.rungs.every(r => approx(r.len, 0.8, 1e-6)));
    // STÆRKT skæve barer (> ~27°) afvises stadig helt
    d.posts[0].height_m = 2.5;
    const dTwist = JSON.parse(JSON.stringify(d));
    dTwist.posts.find(q => q.id === 'p4').z_m = 3.0;   // vrid bar c3 langt væk fra parallel
    const gT = monkeyGeometry(dTwist, at.connA, at.connB, at.spacing_m);
    ok('monkey: stærkt skæve barer → ugyldig/ingen geometri', !monkeyPlacementValid(gT));
  }

  // ---- armgang: ROTERET samling (let skæve barer) er konstruérbar ----
  {
    const d = defaultDesign();
    d.posts = [
      { id: 'p1', x_m: 0, z_m: 0, height_m: 2.5 }, { id: 'p2', x_m: 2.0, z_m: 0, height_m: 2.5 },
      { id: 'p3', x_m: 0, z_m: 0.6, height_m: 2.5 }, { id: 'p4', x_m: 2.0, z_m: 1.0, height_m: 2.5 },
    ];
    d.connections = [
      { id: 'c1', a: 'p1', b: 'p2', height_m: 2.2, material: { source: 'library', id: 'pipe-1' } },
      { id: 'c2', a: 'p3', b: 'p4', height_m: 2.2, material: { source: 'library', id: 'pipe-1' } },
    ];
    const g = monkeyGeometry(d, 'c1', 'c2', 0.33);
    ok('roteret: geometri findes', !!g && g.count >= 2);
    ok('roteret: markeret som drejelig samling', g.angled === true);
    ok('roteret: trinlængder varierer (min < max)', g.lenMin < g.lenMax - 1e-6);
    ok('roteret: gyldig placering (drejelige beslag)', monkeyPlacementValid(g) === true);
    // hvert trin skal hæfte PÅ bar B — fodpunktet ligger inden for barens segment
    const b1 = d.posts[2], b2 = d.posts[3];
    const Lb = Math.hypot(b2.x_m - b1.x_m, b2.z_m - b1.z_m);
    const vx = (b2.x_m - b1.x_m) / Lb, vz = (b2.z_m - b1.z_m) / Lb;
    ok('roteret: alle trin hæfter på begge barer', g.rungs.every(r => {
      const tb = (r.bx - b1.x_m) * vx + (r.bz - b1.z_m) * vz;
      return tb >= 0 && tb <= Lb;
    }));
    // trin, hvis fodpunkt falder UDEN FOR bar B, droppes (kort bar B)
    const dShort = JSON.parse(JSON.stringify(d));
    dShort.posts.find(q => q.id === 'p4').x_m = 1.0;   // bar c2 er nu kun 0..1.0 i x
    const gS = monkeyGeometry(dShort, 'c1', 'c2', 0.33);
    ok('roteret: trin uden fæste droppes', !gS || gS.rungs.every(r => {
      const q1 = dShort.posts[2], q2 = dShort.posts[3];
      const L2 = Math.hypot(q2.x_m - q1.x_m, q2.z_m - q1.z_m);
      const wx = (q2.x_m - q1.x_m) / L2, wz = (q2.z_m - q1.z_m) / L2;
      const tb = (r.bx - q1.x_m) * wx + (r.bz - q1.z_m) * wz;
      return tb >= -1e-9 && tb <= L2 + 1e-9;
    }));
  }

  // ---- delte helpers: spanOfConn + effSpanOfConn (stige-aflastning) ----
  {
    const d = buildPreset('square4');
    const c1 = d.connections.find(c => c.id === 'c1');
    near('spanOfConn c1 = 2,4 m', spanOfConn(d, c1), 2.4, 1e-9);
    // stigen (S1 på p1, angle 0 → langs c1) aflaster c1: eff = max(0,5, 2,4-0,5)
    near('effSpanOfConn med stige = 1,9 m', effSpanOfConn(d, c1), 1.9, 1e-9);
    const c2 = d.connections.find(c => c.id === 'c2');
    near('effSpanOfConn uden stige = spænd', effSpanOfConn(d, c2), spanOfConn(d, c2), 1e-9);
  }

  const passed = results.filter(r => r.ok).length;
  return { passed, failed: results.length - passed, results };
}
