// Serialisering, validering, versionsmigrering og import af det gamle format.
// Det er rygraden i at kunne gemme/dele tegninger sikkert over tid.


// Nøgle den OPRINDELIGE app gemte under (fast firkant-parametre).
const LEGACY_KEY = 'chalestetics-3d';
// Gammel SIZES-rækkefølge → nye biblioteks-id'er.
const LEGACY_SIZE_IDS = ['pipe-3-4', 'pipe-1', 'pipe-1-4', 'wood-10'];

const num = (v, dflt) => (typeof v === 'number' && isFinite(v)) ? v : dflt;
const atLeast = (v, min, dflt) => Math.max(min, num(v, dflt));

function serialize(design) {
  return JSON.stringify(design, null, 2);
}

function deserialize(text) {
  let raw;
  try { raw = JSON.parse(text); } catch (e) { throw new Error('invalid-json'); }
  return adopt(raw);
}

// Tag et rå-objekt (fra fil eller localStorage) og gør det til et gyldigt design.
function adopt(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('not-a-design');
  // Gammelt format fra den oprindelige app?
  if (raw.schemaVersion == null && (raw.lenLong != null || raw.sideSizes != null)) {
    return fromLegacy(raw);
  }
  const migrated = migrate(raw);
  if (!validate(migrated)) throw new Error('invalid-design');
  return migrated;
}

function migrate(raw) {
  const v = raw.schemaVersion || 0;
  if (v > SCHEMA_VERSION) throw new Error('newer-schema'); // afvis nyere filer pænt
  // Fremtidige trin indsættes her, fx:  if (raw.schemaVersion === 1) raw = up1to2(raw);
  return fill(raw);
}

// Er et bibliotekselement brugbart? Objekt med id + gyldig kind + positive
// dimensioner og materialedata — ellers giver fallback-opslag NaN i alle beregninger.
function usableMaterial(m) {
  if (!m || typeof m !== 'object' || !m.id) return false;
  if (!(m.E > 0 && m.sRe > 0 && m.sRm > 0)) return false;
  if (m.kind === 'wood') return m.side > 0;
  if (m.kind === 'pipe') return m.od > 0;
  return false;
}

// Flet et (muligvis ufuldstændigt) design ind i en frisk default, så alle felter findes.
function fill(d) {
  const base = defaultDesign();
  const u = d.units || {};
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const objArr = a => (Array.isArray(a) ? a.filter(isObj) : []);
  const lib = objArr(d.library).filter(usableMaterial);
  const merged = {
    ...base, ...d,
    schemaVersion: SCHEMA_VERSION,
    meta: { ...base.meta, ...(isObj(d.meta) ? d.meta : {}) },
    settings: { ...base.settings, ...(isObj(d.settings) ? d.settings : {}) },
    units: {
      post: { ...base.units.post, ...(isObj(u.post) ? u.post : {}) },
      bar: { ...base.units.bar, ...(isObj(u.bar) ? u.bar : {}) },
      site: { ...base.units.site, ...(isObj(u.site) ? u.site : {}) },
    },
    library: lib.length ? lib : base.library,
    analysis: {
      post: { ...base.analysis.post, ...(isObj((d.analysis || {}).post) ? d.analysis.post : {}) },
      bar: { ...base.analysis.bar, ...(isObj((d.analysis || {}).bar) ? d.analysis.bar : {}) },
    },
    posts: objArr(d.posts),
    connections: objArr(d.connections),
    attachments: objArr(d.attachments),
    stock: isObj(d.stock) ? d.stock : {},
    defaults: {
      ...base.defaults, ...(isObj(d.defaults) ? d.defaults : {}),
      post: { ...base.defaults.post, ...(isObj((d.defaults || {}).post) ? d.defaults.post : {}) },
    },
    site: { ...base.site, ...(isObj(d.site) ? d.site : {}) },
  };
  // Opgradér den gamle hul-standard (30 cm) til den nye (20 cm). Bemærk: en
  // legacy-import kan have sat feltet fra brugerens gamle valg (0,3 m var
  // legacy-default) — default og bevidst valg kan ikke skelnes, så vi
  // accepterer at et bevidst 30 cm-valg også opgraderes.
  if (merged.defaults.post.hole_mm === 300) merged.defaults.post.hole_mm = base.defaults.post.hole_mm;
  merged.library = mergeCatalog(merged.library);
  merged.analysis.post.depth_m = atLeast(merged.analysis.post.depth_m, 0, base.analysis.post.depth_m);
  merged.analysis.post.hole_mm = atLeast(merged.analysis.post.hole_mm, 0, base.analysis.post.hole_mm);
  merged.analysis.post.height_m = atLeast(merged.analysis.post.height_m, 0, base.analysis.post.height_m);
  merged.analysis.bar.span_m = atLeast(merged.analysis.bar.span_m, 0.1, base.analysis.bar.span_m);
  merged.analysis.bar.load_kg = atLeast(merged.analysis.bar.load_kg, 0, base.analysis.bar.load_kg);
  merged.analysis.bar.fixity = Math.min(1, atLeast(merged.analysis.bar.fixity, 0, base.analysis.bar.fixity));
  merged.site.grid_m = atLeast(merged.site.grid_m, 0.01, base.site.grid_m);
  merged.site.connHeight_m = atLeast(merged.site.connHeight_m, 0, base.site.connHeight_m);
  merged.site.postHeight_m = atLeast(merged.site.postHeight_m, 0.1, base.site.postHeight_m);
  merged.site.avatarHeight_m = atLeast(merged.site.avatarHeight_m, 0.3, base.site.avatarHeight_m);
  merged.site.ladderWidth_m = atLeast(merged.site.ladderWidth_m, 0.05, base.site.ladderWidth_m);
  merged.site.refLoad_kg = atLeast(merged.site.refLoad_kg, 0, base.site.refLoad_kg);
  // Den gamle globale værdi beholdes som migreringsfallback for importerede
  // specialrør uden gods. Standardrør har egne dokumenterede værdier.
  merged.site.pipeWall_mm = atLeast(merged.site.pipeWall_mm, 0.5, base.site.pipeWall_mm);
  merged.library.forEach(m => {
    if (m.kind !== 'pipe') return;
    const standard = findMaterial(m.id);
    const fallback = standard ? standard.wall : merged.site.pipeWall_mm;
    m.wall = clampPipeWallMm(m, m.wall, fallback);
  });
  merged.site.monkeySpacing_m = atLeast(merged.site.monkeySpacing_m, 0.15, base.site.monkeySpacing_m);
  if (!SOIL_FACTORS[merged.site.soil]) merged.site.soil = base.site.soil;
  // hul/betonklods kan aldrig være mindre end stolpens eget tværsnit
  const pmFill = resolveMaterial(merged, merged.defaults.post.materialId);
  const postSideMmFill = pmFill ? ((pmFill.kind === 'wood' ? pmFill.side : pmFill.od) || 125) : 125;
  merged.defaults.post.hole_mm = Math.max(merged.defaults.post.hole_mm, postSideMmFill);
  const pmAna = resolveMaterial(merged, merged.analysis.post.materialId);
  merged.analysis.post.hole_mm = Math.max(merged.analysis.post.hole_mm,
    pmAna ? ((pmAna.kind === 'wood' ? pmAna.side : pmAna.od) || 125) : 125);
  // stolper: koordinater SKAL være endelige tal — ellers giver spænd/tegning NaN
  merged.posts = merged.posts.filter(p => isFinite(p.x_m) && isFinite(p.z_m) && p.id != null);
  merged.posts.forEach(p => {
    if (p.height_m != null) p.height_m = atLeast(p.height_m, 0.1, merged.site.postHeight_m);
    if (p.depth_m != null) p.depth_m = atLeast(p.depth_m, 0.1, merged.defaults.post.depth_m);
    if (p.hole_mm != null) p.hole_mm = atLeast(p.hole_mm, postSideMmFill, merged.defaults.post.hole_mm);
  });
  // forbindelser skal pege på eksisterende stolper
  const postIds = new Set(merged.posts.map(p => p.id));
  merged.connections = merged.connections.filter(c => postIds.has(c.a) && postIds.has(c.b) && c.id != null);
  const postById = Object.fromEntries(merged.posts.map(p => [p.id, p]));
  const postHeight = p => p.height_m != null ? p.height_m : merged.site.postHeight_m;
  merged.connections.forEach(c => {
    const maxHeight = Math.min(postHeight(postById[c.a]), postHeight(postById[c.b]));
    c.height_m = Math.min(atLeast(c.height_m, 0, merged.site.connHeight_m), maxHeight);
    if (c.material && typeof c.material === 'object') {
      const baseMat = resolveMaterial(merged, c.material.id);
      if (baseMat.kind === 'pipe' && c.material.wall != null) {
        const wall = clampPipeWallMm(baseMat, c.material.wall, baseMat.wall);
        if (Math.abs(wall - baseMat.wall) < 1e-9) delete c.material.wall;
        else c.material.wall = wall;
      } else {
        delete c.material.wall;
      }
    }
  });
  // attachments: stiger/personer skal pege på noget der findes
  merged.attachments = merged.attachments.filter(a =>
    a.type !== 'ladder' || postIds.has(a.postId));
  merged.attachments = merged.attachments.filter(a =>
    a.type !== 'avatar' || (isFinite(a.x_m) && isFinite(a.z_m)));
  merged.attachments.forEach(a => {
    if (a.type === 'ladder') a.width_m = atLeast(a.width_m, 0.05, merged.site.ladderWidth_m);
    if (a.type === 'avatar') a.height_m = atLeast(a.height_m, 0.3, merged.site.avatarHeight_m);
    if (a.type === 'monkey') a.spacing_m = atLeast(a.spacing_m, 0.15, merged.site.monkeySpacing_m);
  });
  // armgange der peger på slettede forbindelser er meningsløse — smid dem ud
  merged.attachments = merged.attachments.filter(a => a.type !== 'monkey'
    || (merged.connections.some(c => c.id === a.connA) && merged.connections.some(c => c.id === a.connB)));
  Object.keys(merged.stock || {}).forEach(id => { merged.stock[id] = atLeast(merged.stock[id], 0.5, 0.5); });
  return merged;
}

// Hold de indbyggede materialer i biblioteket opdaterede med kataloget:
// nye materialer tilføjes, navne/mål på indbyggede opdateres, egne bevares.
function mergeCatalog(lib) {
  const out = Array.isArray(lib) ? lib.slice() : [];
  for (const c of CATALOG) {
    const i = out.findIndex(m => m.id === c.id);
    if (i < 0) out.push({ ...c, builtin: true });
    else if (out[i].builtin) {
      // En eksplicit bruger-overstyring af gods skal overleve genindlæsning,
      // mens alle øvrige data på indbyggede materialer fortsat følger kataloget.
      const customWall = out[i].wallCustom === true
        ? clampPipeWallMm(c, out[i].wall, c.wall)
        : c.wall;
      out[i] = { ...c, builtin: true, wall: customWall };
      if (customWall !== c.wall) out[i].wallCustom = true;
    }
  }
  return out;
}

function validate(d) {
  return !!d && d.schemaVersion === SCHEMA_VERSION
    && d.settings && (d.settings.lang === 'da' || d.settings.lang === 'en')
    && Array.isArray(d.library) && d.library.length > 0
    && d.analysis && d.analysis.post && d.analysis.bar
    && Array.isArray(d.posts) && Array.isArray(d.connections);
}

// Konvertér den oprindelige apps gemte data (fast firkant) til den nye graf-model.
function fromLegacy(o) {
  const d = defaultDesign();
  const lenLong = atLeast(o.lenLong, 0.1, 2.4), lenShort = atLeast(o.lenShort, 0.1, 1.2);
  const hL = (lenLong + POST) / 2, hS = (lenShort + POST) / 2;
  const corners = [{ x: -hL, z: -hS }, { x: hL, z: -hS }, { x: hL, z: hS }, { x: -hL, z: hS }];
  d.posts = corners.map((c, i) => ({ id: 'p' + (i + 1), x_m: c.x, z_m: c.z, override: null }));

  const sides = [[0, 1], [1, 2], [2, 3], [3, 0]]; // A, B, C, D
  const heights = Array.isArray(o.heights) ? o.heights : [2.7, 2.3, 1.5, 1.0];
  const sizeIdx = Array.isArray(o.sideSizes) ? o.sideSizes : [1, 1, 1, 1];
  d.connections = sides.map((s, i) => ({
    id: 'c' + (i + 1),
    a: 'p' + (s[0] + 1), b: 'p' + (s[1] + 1),
    height_m: atLeast(heights[i], 0, 1.5),
    material: { source: 'library', id: LEGACY_SIZE_IDS[sizeIdx[i]] || 'pipe-1' },
    onTop: atLeast(heights[i], 0, 0) >= POST_ABOVE,
  }));

  d.attachments = [{ id: 'a1', type: 'ladder', postId: 'p1', connectionId: 'c1', width_m: atLeast(o.ladderWidth, 0.05, 0.5) }];
  d.defaults = {
    post: { materialId: 'wood-125', depth_m: atLeast(o.depth, 0, 1.2), hole_mm: atLeast(o.hole, 0, 0.3) * 1000, height_m: POST_ABOVE },
    soil: {},
    load: { centerKg: atLeast(o.load, 0, 120), fixity: 0.25 },
  };
  d.analysis.bar.load_kg = atLeast(o.load, 0, 120);
  d.meta.name = 'Importeret rig';
  return d;
}
