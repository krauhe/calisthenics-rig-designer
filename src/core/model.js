// Datamodellen: ét JSON-serialiserbart "design"-objekt er sandheden.
// Indeholder settings/units/library/analysis samt sted-modellen (posts,
// connections, attachments, stock) og de delte, rene opslags-hjælpere.


const SCHEMA_VERSION = 1;

function defaultDesign() {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { name: 'Min rig', created: Date.now(), modified: Date.now() },
    settings: { lang: 'da' },
    // Enheder uafhængigt pr. fane:
    units: {
      post: { len: 'm', dim: 'mm' },
      bar:  { len: 'm', dim: 'mm', mass: 'kg' },
      site: { len: 'm' },
    },
    // Materialebibliotek (kim = standardkataloget; brugeren kan tilføje egne):
    library: CATALOG.map(m => ({ ...m, builtin: true })),
    // Selvstændige analyse-faner:
    analysis: {
      post: { materialId: 'wood-125', depth_m: 1.2, hole_mm: 200, height_m: 2.7 },
      bar:  { materialId: 'pipe-1', span_m: 2.4, load_kg: 120, fixity: 0.25 },
    },
    // Sted-model (kort-editoren):
    posts: [],
    connections: [],
    attachments: [],
    stock: {},
    // Kort-editorens indstillinger:
    site: {
      grid_m: 0.125,          // gitter-opløsning (default = stolpetykkelse 12,5 cm)
      connMaterialId: 'pipe-1',
      connHeight_m: 2.0,
      postHeight_m: 3.0,  // standard stolpehøjde over jord (for nye stolper)
      avatarHeight_m: 1.80,  // standard personhøjde (for nye avatarer)
      ladderWidth_m: 0.5,
      refLoad_kg: 120,    // designlast pr. bar (til kritisk-markering på kortet)
      pipeWall_mm: 3.2,   // antaget rør-godstykkelse for ALLE rør (alm. galv. vandrør, EN10255 medium)
      monkeySpacing_m: 0.33,  // trinafstand for armgang (monkey bars)
      soil: 'normal',     // jordtype: 'soft' | 'normal' | 'firm' — skalerer fundamentstivheden
    },
    defaults: {
      post: { materialId: 'wood-125', depth_m: 1.2, hole_mm: 200, height_m: 3.0 },
      soil: {},
      load: { centerKg: 120, fixity: 0.25 },
    },
  };
}

// Slå et materiale op i designets bibliotek (falder tilbage til første).
function resolveMaterial(design, id) {
  return design.library.find(m => m.id === id) || design.library[0];
}

// ---- Delte visnings-/opslags-hjælpere for stolper og forbindelser ----
// Ren, side-effekt-fri logik der ellers var duplikeret i Kort/3D/Materialer/Print.

// Bogstav-label for stolpe nr. i (0-indekseret): A, B, C … Z, derefter '#'+n.
function letterFor(i) { return i < 26 ? String.fromCharCode(65 + i) : '#' + (i + 1); }

// Bogstavet for en given stolpe-id (via dens indeks i design.posts); '?' hvis ukendt.
function postLetterOf(design, id) {
  const i = design.posts.findIndex(p => p.id === id);
  return i < 0 ? '?' : letterFor(i);
}

// Label for en forbindelse: de to stolpe-bogstaver, sorteret og bindestregs-adskilt.
function connLabelOf(design, c) {
  return [postLetterOf(design, c.a), postLetterOf(design, c.b)].sort().join('–');
}

// Labels for attachments: armgange hedder M1, M2 … og stiger S1, S2 …
// (indeks blandt attachments af samme type, i deres rækkefølge i designet).
function attachmentLabelOf(design, at, type, prefix) {
  const list = design.attachments.filter(a => a.type === type);
  const i = list.findIndex(a => a.id === at.id);
  return i < 0 ? prefix + '?' : prefix + (i + 1);
}
function monkeyLabelOf(design, at) { return attachmentLabelOf(design, at, 'monkey', 'M'); }
function ladderLabelOf(design, at) { return attachmentLabelOf(design, at, 'ladder', 'S'); }

// Slå forbindelsens materiale op (ref kan være {source:'library', id} eller en ren id).
function connMatOf(design, ref) {
  const id = ref && ref.source === 'library' ? ref.id : ref;
  return design.library.find(m => m.id === id) || design.library[0];
}

// Stolpens højde over jord, dybde og hul/betonklods (mm) — egne værdier pr.
// stolpe, ellers design-standarderne.
function postHeightOfD(design, p) {
  return p.height_m != null ? p.height_m : (design.site.postHeight_m || 3.0);
}
function postDepthOfD(design, p) {
  return p.depth_m != null ? p.depth_m : ((design.defaults.post && design.defaults.post.depth_m) || 1.2);
}
function postHoleMmOf(design, p) {
  return p.hole_mm != null ? p.hole_mm : ((design.defaults.post && design.defaults.post.hole_mm) || 200);
}

// Spændvidden (m) for en forbindelse ud fra dens to stolpers positioner; 0 hvis ukendt.
function spanOfConn(design, c) {
  const a = design.posts.find(p => p.id === c.a), b = design.posts.find(p => p.id === c.b);
  return (a && b) ? Math.hypot(b.x_m - a.x_m, b.z_m - a.z_m) : 0;
}

// Hvilken vandret bar binder en stige sig til? Den forbindelse på stolpen, hvis
// retning bedst matcher stigens vinkel (uden vinkel: den højeste bar).
// Delt af Kort, 3D, Materialer og Print, så alle fire viser SAMME stige.
function ladderBarOf(design, at) {
  const byId = Object.fromEntries(design.posts.map(p => [p.id, p]));
  const conns = design.connections.filter(c => c.a === at.postId || c.b === at.postId);
  const p = byId[at.postId]; if (!conns.length || !p) return null;
  const dirTo = c => { const o = byId[c.a === at.postId ? c.b : c.a]; return o ? Math.atan2(o.z_m - p.z_m, o.x_m - p.x_m) : 0; };
  let best = conns[0];
  if (at.angle_rad == null) { for (const c of conns) if (c.height_m > best.height_m) best = c; }
  else {
    let bd = Infinity;
    for (const c of conns) {
      const d = dirTo(c);
      const diff = Math.abs(((d - at.angle_rad + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
      if (diff < bd) { bd = diff; best = c; }
    }
  }
  const a = dirTo(best);
  return { conn: best, height: best.height_m, dx: Math.cos(a), dz: Math.sin(a) };
}

// Effektiv (bærende) spændvidde: en stige der binder til baren virker som et
// ekstra støttepunkt — det længste ustøttede stykke styrer styrke/nedbøjning.
function effSpanOfConn(design, c) {
  const span = spanOfConn(design, c);
  let relief = 0;
  for (const at of design.attachments) {
    if (at.type !== 'ladder') continue;
    const bar = ladderBarOf(design, at);
    if (bar && bar.conn && bar.conn.id === c.id) relief = Math.max(relief, Math.max(0.05, at.width_m || 0.5));
  }
  return relief > 0 ? Math.max(0.05, Math.max(relief, span - relief)) : span;
}

// Udadgående retning til en stolpes label (væk fra de nærmeste stolpers
// tyngdepunkt) — delt af Kort og 3D, så labels lander samme sted.
function postLabelDirOf(design, p, idx) {
  const posts = design.posts || [];
  if (!posts.length) return { x: 1, z: 0 };   // ingen stolper: undgå division med nul/NaN
  const nearest = posts
    .slice()
    .sort((a, b) => Math.hypot(a.x_m - p.x_m, a.z_m - p.z_m) - Math.hypot(b.x_m - p.x_m, b.z_m - p.z_m))
    .slice(0, Math.min(4, posts.length));
  const centroid = pts => pts.reduce((s, q) => ({ x: s.x + q.x_m, z: s.z + q.z_m }), { x: 0, z: 0 });
  let c = nearest.length ? centroid(nearest) : { x: 0, z: 0 };
  if (nearest.length) { c.x /= nearest.length; c.z /= nearest.length; }
  let dx = p.x_m - c.x, dz = p.z_m - c.z;
  if (Math.hypot(dx, dz) < 1e-6 && posts.length > 1) {
    c = centroid(posts); c.x /= posts.length; c.z /= posts.length;
    dx = p.x_m - c.x; dz = p.z_m - c.z;
  }
  if (Math.hypot(dx, dz) < 1e-6) {
    const a = (idx / Math.max(1, posts.length)) * Math.PI * 2 - Math.PI / 2;
    dx = Math.cos(a); dz = Math.sin(a);
  }
  const d = Math.hypot(dx, dz) || 1;
  return { x: dx / d, z: dz / d };
}

// Jordtype → faktor på fundamentets jordstivhed (K_SOIL). Groft, men nok til
// at "blød stolpe"-flaget reagerer på pladsens forhold.
const SOIL_FACTORS = { soft: 0.45, normal: 1.0, firm: 1.7 };
function soilFactorOf(design) {
  return SOIL_FACTORS[(design.site && design.site.soil) || 'normal'] || 1.0;
}

// ---- Armgang (monkey bars): trin mellem to nogenlunde parallelle barer ----
// Ren geometri, delt af Kort, 3D og Materialer. Returnerer null hvis
// geometrien slet ikke kan beregnes; ellers trin + nøgletal, så kalderen selv
// kan afgøre hvor strengt der skal valideres (placering er strengere end visning).
function monkeyGeometry(design, connA, connB, spacing_m) {
  const byId = Object.fromEntries(design.posts.map(p => [p.id, p]));
  const ca = design.connections.find(c => c.id === connA);
  const cb = design.connections.find(c => c.id === connB);
  if (!ca || !cb || ca.id === cb.id) return null;
  const a1 = byId[ca.a], a2 = byId[ca.b], b1 = byId[cb.a], b2 = byId[cb.b];
  if (!a1 || !a2 || !b1 || !b2) return null;
  let ux = a2.x_m - a1.x_m, uz = a2.z_m - a1.z_m;
  const La = Math.hypot(ux, uz); if (La < 0.15) return null;
  ux /= La; uz /= La;
  const vxr = b2.x_m - b1.x_m, vzr = b2.z_m - b1.z_m;
  const Lb = Math.hypot(vxr, vzr); if (Lb < 0.15) return null;
  const vx = vxr / Lb, vz = vzr / Lb;
  const cross = Math.abs(ux * vz - uz * vx);      // 0 = parallelle
  if (cross > 0.45) return null;                  // > ~27° kan ikke tegnes fornuftigt
  // projicér bar B's endepunkter på bar A's retning (origo = a1)
  const proj = q => (q.x_m - a1.x_m) * ux + (q.z_m - a1.z_m) * uz;
  const tb1 = proj(b1), tb2 = proj(b2);
  const start = Math.max(0, Math.min(tb1, tb2)), end = Math.min(La, Math.max(tb1, tb2));
  if (end - start < 0.15) return null;            // (næsten) intet overlap
  // vinkelret afstand (= trinlængde) målt midt i overlappet
  const nearestOnB = (x, z) => {
    const t = ((x - b1.x_m) * vx + (z - b1.z_m) * vz);
    return { x: b1.x_m + vx * t, z: b1.z_m + vz * t };
  };
  const tm = (start + end) / 2;
  const pmx = a1.x_m + ux * tm, pmz = a1.z_m + uz * tm;
  const qm = nearestOnB(pmx, pmz);
  const gap = Math.hypot(qm.x - pmx, qm.z - pmz);
  if (gap < 0.05 || gap > 2.5) return null;
  const sp = Math.max(0.15, spacing_m || (design.site && design.site.monkeySpacing_m) || 0.33);
  const margin = 0.12;                            // luft til beslag i enderne
  const usable = end - start - 2 * margin;
  const n = usable >= 0 ? Math.floor(usable / sp) + 1 : 1;
  const off = start + (end - start - (n - 1) * sp) / 2;
  const rungs = [];
  for (let k = 0; k < n; k++) {
    const t = off + k * sp;
    const ax = a1.x_m + ux * t, az = a1.z_m + uz * t;
    // fodpunktet på bar B — trinnet skal HÆFTE på selve baren (ikke dens
    // forlængelse), ellers tegnes/faktureres trin ud i den blå luft, når en
    // stolpe trækkes og barerne ikke længere er parallelle
    const tb = (ax - b1.x_m) * vx + (az - b1.z_m) * vz;
    if (tb < margin - 1e-9 || tb > Lb - margin + 1e-9) continue;
    const bx = b1.x_m + vx * tb, bz = b1.z_m + vz * tb;
    rungs.push({ ax, az, bx, bz, len: Math.hypot(bx - ax, bz - az) });
  }
  if (!rungs.length) return null;
  const lens = rungs.map(r => r.len);
  const hdiff = Math.abs((ca.height_m || 0) - (cb.height_m || 0));
  return {
    ca, cb, rungs, count: rungs.length, rungLen: gap, gap, cross, hdiff,
    lenMin: Math.min(...lens), lenMax: Math.max(...lens),
    // roteret samling: barerne er ikke parallelle (> ~2°) — kan konstrueres
    // med DREJELIGE beslag; trinlængderne varierer, og materialelisten skal
    // fakturere svingbare koblinger i stedet for faste klemmer
    angled: cross > 0.035,
    overlap: end - start,
    mid: { x: (pmx + qm.x) / 2, z: (pmz + qm.z) / 2 },
    y: Math.min(ca.height_m || 0, cb.height_m || 0),   // grebshøjde = laveste bar
  };
}

// Streng gyldighed til PLACERING (visning er mere tolerant, så en placeret
// armgang ikke forsvinder bare fordi en stolpe flyttes lidt).
// Ikke-parallelle barer er TILLADT (op til geometriens ~27°) — de kræver
// blot drejelige beslag (g.angled); men hvert trin skal være i grebs-venlig
// længde, og barerne skal sidde i nogenlunde samme højde.
function monkeyPlacementValid(g) {
  return !!g && g.lenMin >= 0.25 && g.lenMax <= 1.6
    && g.overlap >= 0.4 && g.hdiff <= 0.3;
}

// Kan et bar-par overhovedet BÆRE en armgang (til placering/par-vælger)?
// Som monkeyPlacementValid men UDEN højdekravet: en højdeforskel blokerer
// ikke — den udlignes automatisk ved placering (begge barer sættes til den
// lavestes højde, samme regel som H-feltet i skemaet).
function monkeyPairPlaceable(g) {
  return !!g && g.lenMin >= 0.25 && g.lenMax <= 1.6 && g.overlap >= 0.4;
}

// Udlign de to barers højde til den laveste (bruges når en armgang placeres
// eller flyttes til et par med højdeforskel — trinnene skal hæfte i samme kote).
function alignMonkeyBars(design, connA, connB) {
  const ca = design.connections.find(c => c.id === connA);
  const cb = design.connections.find(c => c.id === connB);
  if (!ca || !cb) return;
  if (Math.abs((ca.height_m || 0) - (cb.height_m || 0)) <= 0.3) return;
  const h = Math.min(ca.height_m || 0, cb.height_m || 0);
  ca.height_m = h; cb.height_m = h;
}

// Armgangens maksimale grebshøjde: trinnene hæfter i BEGGE barer, så højden
// er begrænset af den laveste af de fire bærende stolper (begge barers ender).
// null hvis armgangens barer/stolper ikke kan slås op.
function monkeyMaxHeight(design, at) {
  const ca = design.connections.find(c => c.id === at.connA);
  const cb = design.connections.find(c => c.id === at.connB);
  if (!ca || !cb) return null;
  const hOf = id => {
    const p = design.posts.find(q => q.id === id);
    return p ? postHeightOfD(design, p) : null;
  };
  const hs = [ca.a, ca.b, cb.a, cb.b].map(hOf);
  if (hs.some(h => h == null)) return null;
  return Math.min(...hs);
}
