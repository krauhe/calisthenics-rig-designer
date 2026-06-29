// Datamodellen: ét JSON-serialiserbart "design"-objekt er sandheden.
// I denne fase bruges kun settings/units/library/analysis. Posts, connections,
// attachments og stock kommer i de senere faser (kort + 3D + materialeliste).


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
      post: { materialId: 'wood-125', depth_m: 1.2, hole_mm: 300, height_m: 2.7 },
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
      ladderWidth_m: 0.5,
    },
    defaults: {
      post: { materialId: 'wood-125', depth_m: 1.2, hole_mm: 300, height_m: 3.0 },
      soil: {},
      load: { centerKg: 120, fixity: 0.25 },
    },
  };
}

// Slå et materiale op i designets bibliotek (falder tilbage til første).
function resolveMaterial(design, id) {
  return design.library.find(m => m.id === id) || design.library[0];
}
