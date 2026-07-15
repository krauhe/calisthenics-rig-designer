// Standard-materialekatalog. Dette er "kimen" til brugerens materialebibliotek
// og svarer 1:1 til den oprindelige SIZES-liste.
//
// Materialer refereres ved stabilt 'id' (ikke ved listeindeks som før), så
// rækkefølgen kan ændres uden at ødelægge gemte tegninger.
//
// Dimensioner i mm; E, sRe, sRm i Pa.
//   sRe = arbejds-/flydegrænse · sRm = brud-/maksgrænse
// Stål: EN 10255 S195T. Træ: C24 fyr.

const CATALOG = [
  { id: 'pipe-3-4', name: '3/4" rør',   kind: 'pipe', od: 26.9, wall: 2.6, E: 210e9, sRe: 195e6, sRm: 320e6 },
  { id: 'pipe-1',   name: '1" rør',     kind: 'pipe', od: 33.7, wall: 3.2, E: 210e9, sRe: 195e6, sRm: 320e6 },
  { id: 'pipe-1-4', name: '1 1/4" rør', kind: 'pipe', od: 42.4, wall: 3.2, E: 210e9, sRe: 195e6, sRm: 320e6 },
  { id: 'wood-10',  name: '10×10 træ', kind: 'wood', side: 100,           E: 10e9,  sRe: 10e6,  sRm: 24e6  },
  { id: 'wood-125', name: '12,5×12,5 træ', kind: 'wood', side: 125,       E: 10e9,  sRe: 10e6,  sRm: 24e6  },
  { id: 'wood-15',  name: '15×15 træ',     kind: 'wood', side: 150,       E: 10e9,  sRe: 10e6,  sRm: 24e6  },
];

// Slå et katalog-/bibliotekselement op på id.
function findMaterial(id, library = CATALOG) {
  return library.find(m => m.id === id) || null;
}

// Fornuftig sortering: rør først (efter ydre-Ø), derefter træ (efter sidemål) — stigende.
function sortLibrary(lib) {
  const dim = m => (m.kind === 'wood' ? m.side : m.od) || 0;
  return lib.slice().sort((a, b) => (a.kind === b.kind ? dim(a) - dim(b) : (a.kind === 'pipe' ? -1 : 1)));
}

// Semantisk farve: rør = blå, træ = brun (tykkelse viser dimension, rød = kritisk).
function materialColor(m) {
  return m && m.kind === 'wood' ? '#a06a32' : '#0b66c3';
}

// Nuancer af materialefarven til at adskille nabostykker i skærelisten —
// holder sig på samme kulør (blå rør / brun træ) i stedet for regnbue.
function segShades(m) {
  return m && m.kind === 'wood'
    ? ['#a06a32', '#c2924f', '#7d5125', '#b5803f', '#8a5b28']
    : ['#0b66c3', '#2f8fde', '#094f99', '#4aa3e8', '#1d7ad1'];
}

// ---- Materialeoptælling: indkøbs- og skæreliste udledt af tegningen ----
// Ren kerne-funktion (ingen DOM) — bruges af Materialer-fanen og Print, og
// testes i tests/tests.js. Bruger de delte hjælpere i model.js, så stiger og
// armgange faktureres ud fra SAMME geometri som Kort og 3D viser.
function computeMaterials(design) {
  const connMat = ref => connMatOf(design, ref);
  const spanOf = c => spanOfConn(design, c);

  const depth = (design.defaults.post && design.defaults.post.depth_m) || 1.2;
  const hole = ((design.defaults.post && design.defaults.post.hole_mm) || 200) / 1000;
  // pr. stolpe-mål (som på Kort) — falder tilbage til standarderne
  const postHeightOf = p => postHeightOfD(design, p);
  const postDepthOf = p => postDepthOfD(design, p);
  const postHoleM = p => postHoleMmOf(design, p) / 1000;
  const postMat = resolveMaterial(design, design.defaults.post.materialId);
  const postSide = (postMat.side || postMat.od || 125) / 1000;
  const postCount = design.posts.length;
  const connLbl = c => connLabelOf(design, c);

  // bar-grupper (perimeter) til tabellen, pr. materiale
  const barGroups = {};   // id -> { mat, totalLen, count }
  design.connections.forEach(c => {
    const span = spanOf(c); if (span <= 0) return;
    const mat = connMat(c.material);
    const g = barGroups[mat.id] = barGroups[mat.id] || { mat, totalLen: 0, count: 0 };
    g.totalLen += span; g.count++;
  });

  // skære-stykker pr. materiale: stolper + barer/overliggere (rør OG træ) + stige-rør
  const cut = {};         // id -> { mat, pieces:[{len,label}] }
  const addCut = (mat, len, label) => { if (!mat || len <= 0) return; (cut[mat.id] = cut[mat.id] || { mat, pieces: [] }).pieces.push({ len, label }); };
  // stolper (lodrette) — hver: egen højde over jord + egen nedgravning (fra Kort)
  let postTotalLen = 0, buriedTotal = 0;
  design.posts.forEach((p, i) => { const lenP = postHeightOf(p) + postDepthOf(p); postTotalLen += lenP; buriedTotal += postDepthOf(p); addCut(postMat, lenP, letterFor(i)); });
  // barer / overliggere
  design.connections.forEach(c => addCut(connMat(c.material), spanOf(c), connLbl(c)));

  // stiger — bar-valget deles med Kort/3D/Print (model.js), så alle fire faner
  // fakturerer den SAMME bar (før valgte materialelisten altid den højeste).
  // ladderMat kan være null (intet rør-bibliotek) — addCut no-opper stille når mat er null,
  // så stige-/armgangs-tællere (ladVert, ladRungCount osv.) opgøres stadig, men uden skæreliste-stykker.
  const ladderMat = design.library.find(m => m.id === 'pipe-1') || design.library.find(m => m.kind === 'pipe') || null;
  let ladVert = 0, ladRungLen = 0, ladRungCount = 0, ladKee = 0, ladderCount = 0;
  design.attachments.forEach(at => {
    if (at.type !== 'ladder') return;
    ladderCount++;
    const lbl = ladderLabelOf(design, at);
    const bar = ladderBarOf(design, at);
    const barY = Math.max(0, bar ? bar.height : (design.site.connHeight_m || 2.2));
    const width = Math.max(0.05, at.width_m || 0.5);
    const vert = barY + 0.5;
    const rc = Math.max(0, Math.floor((barY - 0.25) / 0.40));
    ladVert += vert; ladRungCount += rc; ladRungLen += rc * width; ladKee += 1 + rc * 2;
    addCut(ladderMat, vert, lbl);
    for (let k = 0; k < rc; k++) addCut(ladderMat, width, lbl + 't' + (k + 1));
  });

  // armgange (monkey bars): 1"-trin mellem to barer + 2 beslag pr. trin.
  // Trin skæres i deres FAKTISKE længde (varierer ved roteret samling), og
  // ikke-parallelle barer kræver justerbare kryds-beslag i stedet for faste
  // kryds-klemmer (crossover).
  let monRungCount = 0, monRungLen = 0, monKee = 0, monSwivel = 0, monkeyCount = 0;
  design.attachments.forEach(at => {
    if (at.type !== 'monkey') return;
    const g = monkeyGeometry(design, at.connA, at.connB, at.spacing_m);
    if (!g || !g.rungs.length) return;
    monkeyCount++;
    const lbl = monkeyLabelOf(design, at);
    monRungCount += g.count;
    g.rungs.forEach((r, k) => { monRungLen += r.len; addCut(ladderMat, r.len, lbl + 'g' + (k + 1)); });
    if (g.angled) monSwivel += g.count * 2; else monKee += g.count * 2;
  });

  // fundament — pr. stolpe (egen dybde + hul fra Kort)
  const footVol = 0.22 * 0.22 * 0.5;
  let concVol = 0, gravelVol = 0, tarArea = 0;
  design.posts.forEach(p => {
    const dP = postDepthOf(p), hP = postHoleM(p);
    concVol += (hP * hP - postSide * postSide) * Math.max(0, dP - GRAVEL_H);
    gravelVol += hP * hP * GRAVEL_H;
    // tjære-zone = hele den nedgravede del + TAR_TOP over jord (matcher print.step3)
    tarArea += 4 * postSide * (TAR_TOP + dP) + postSide * postSide;
  });
  concVol += footVol * ladderCount;
  gravelVol += 0.22 * 0.22 * GRAVEL_H * ladderCount;
  const bags25 = Math.ceil(concVol / 0.0125);
  const tarLitre = tarArea * 0.35;
  const pipeConnCount = design.connections.filter(c => connMat(c.material).kind === 'pipe').length;

  return {
    postMat, postCount, postTotalLen, buriedTotal, depth, postSide, hole,
    barGroups, cut, pipeConnCount,
    ladderCount, ladVert, ladRungLen, ladRungCount, ladKee,
    monkeyCount, monRungCount, monRungLen, monKee, monSwivel,
    concVol, gravelVol, bags25, tarLitre,
  };
}
