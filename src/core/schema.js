// Serialisering, validering, versionsmigrering og import af det gamle format.
// Det er rygraden i at kunne gemme/dele tegninger sikkert over tid.


// Nøgle den OPRINDELIGE app gemte under (fast firkant-parametre).
const LEGACY_KEY = 'chalestetics-3d';
// Gammel SIZES-rækkefølge → nye biblioteks-id'er.
const LEGACY_SIZE_IDS = ['pipe-3-4', 'pipe-1', 'pipe-1-4', 'wood-10'];

const num = (v, dflt) => (typeof v === 'number' && isFinite(v)) ? v : dflt;

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

// Flet et (muligvis ufuldstændigt) design ind i en frisk default, så alle felter findes.
function fill(d) {
  const base = defaultDesign();
  const u = d.units || {};
  const merged = {
    ...base, ...d,
    schemaVersion: SCHEMA_VERSION,
    meta: { ...base.meta, ...(d.meta || {}) },
    settings: { ...base.settings, ...(d.settings || {}) },
    units: {
      post: { ...base.units.post, ...(u.post || {}) },
      bar: { ...base.units.bar, ...(u.bar || {}) },
      site: { ...base.units.site, ...(u.site || {}) },
    },
    library: Array.isArray(d.library) && d.library.length ? d.library : base.library,
    analysis: {
      post: { ...base.analysis.post, ...((d.analysis || {}).post || {}) },
      bar: { ...base.analysis.bar, ...((d.analysis || {}).bar || {}) },
    },
    posts: Array.isArray(d.posts) ? d.posts : base.posts,
    connections: Array.isArray(d.connections) ? d.connections : base.connections,
    attachments: Array.isArray(d.attachments) ? d.attachments : base.attachments,
    stock: d.stock || base.stock,
    defaults: d.defaults || base.defaults,
    site: { ...base.site, ...(d.site || {}) },
  };
  merged.library = mergeCatalog(merged.library);
  return merged;
}

// Hold de indbyggede materialer i biblioteket opdaterede med kataloget:
// nye materialer tilføjes, navne/mål på indbyggede opdateres, egne bevares.
function mergeCatalog(lib) {
  const out = Array.isArray(lib) ? lib.slice() : [];
  for (const c of CATALOG) {
    const i = out.findIndex(m => m.id === c.id);
    if (i < 0) out.push({ ...c, builtin: true });
    else if (out[i].builtin) out[i] = { ...c, builtin: true };
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
  const lenLong = num(o.lenLong, 2.4), lenShort = num(o.lenShort, 1.2);
  const hL = (lenLong + POST) / 2, hS = (lenShort + POST) / 2;
  const corners = [{ x: -hL, z: -hS }, { x: hL, z: -hS }, { x: hL, z: hS }, { x: -hL, z: hS }];
  d.posts = corners.map((c, i) => ({ id: 'p' + (i + 1), x_m: c.x, z_m: c.z, override: null }));

  const sides = [[0, 1], [1, 2], [2, 3], [3, 0]]; // A, B, C, D
  const heights = Array.isArray(o.heights) ? o.heights : [2.7, 2.3, 1.5, 1.0];
  const sizeIdx = Array.isArray(o.sideSizes) ? o.sideSizes : [1, 1, 1, 1];
  d.connections = sides.map((s, i) => ({
    id: 'c' + (i + 1),
    a: 'p' + (s[0] + 1), b: 'p' + (s[1] + 1),
    height_m: num(heights[i], 1.5),
    material: { source: 'library', id: LEGACY_SIZE_IDS[sizeIdx[i]] || 'pipe-1' },
    onTop: num(heights[i], 0) >= POST_ABOVE,
  }));

  d.attachments = [{ id: 'a1', type: 'ladder', postId: 'p1', connectionId: 'c1', width_m: num(o.ladderWidth, 0.5) }];
  d.defaults = {
    post: { materialId: 'wood-125', depth_m: num(o.depth, 1.2), hole_mm: num(o.hole, 0.3) * 1000, height_m: POST_ABOVE },
    soil: {},
    load: { centerKg: num(o.load, 120), fixity: 0.25 },
  };
  d.analysis.bar.load_kg = num(o.load, 120);
  d.meta.name = 'Importeret rig';
  return d;
}
