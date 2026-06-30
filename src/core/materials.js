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
