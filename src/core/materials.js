// Standard-materialekatalog. Dette er "kimen" til brugerens materialebibliotek
// og svarer 1:1 til den oprindelige SIZES-liste.
//
// Materialer refereres ved stabilt 'id' (ikke ved listeindeks som før), så
// rækkefølgen kan ændres uden at ødelægge gemte tegninger.
//
// Dimensioner i mm; E, sRe, sRm i Pa.
//   sRe = arbejds-/flydegrænse · sRm = brud-/maksgrænse
// Stål: EN 10255 S195T. Træ: C24 fyr.

export const CATALOG = [
  { id: 'pipe-3-4', name: '3/4"',      kind: 'pipe', od: 26.9, wall: 2.6, E: 210e9, sRe: 195e6, sRm: 320e6 },
  { id: 'pipe-1',   name: '1"',        kind: 'pipe', od: 33.7, wall: 3.2, E: 210e9, sRe: 195e6, sRm: 320e6 },
  { id: 'pipe-1-4', name: '1 1/4"',    kind: 'pipe', od: 42.4, wall: 3.2, E: 210e9, sRe: 195e6, sRm: 320e6 },
  { id: 'wood-10',  name: '10×10 træ', kind: 'wood', side: 100,           E: 10e9,  sRe: 10e6,  sRm: 24e6  },
  { id: 'wood-125', name: '12,5×12,5 træ', kind: 'wood', side: 125,       E: 10e9,  sRe: 10e6,  sRm: 24e6  },
  { id: 'wood-15',  name: '15×15 træ',     kind: 'wood', side: 150,       E: 10e9,  sRe: 10e6,  sRm: 24e6  },
];

// Slå et katalog-/bibliotekselement op på id.
export function findMaterial(id, library = CATALOG) {
  return library.find(m => m.id === id) || null;
}
