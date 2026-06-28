// Tilstands-container: holder design-objektet, gemmer automatisk i localStorage,
// og giver besked til abonnenter ved ændringer.

import { defaultDesign, SCHEMA_VERSION } from './model.js';

const KEY = 'calisthenics-rig-designer';

let design = loadDesign();
const subs = new Set();
let saveTimer = null;

export function getDesign() { return design; }

export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

// Kald efter en ændring i design: notificér + gem (debounced).
export function commit() {
  design.meta.modified = Date.now();
  subs.forEach(fn => fn(design));
  scheduleSave();
}

// Bekvem helper: muter design og commit i ét.
export function update(mutator) { mutator(design); commit(); }

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(design)); } catch (e) { /* fuld/privat */ }
  }, 300);
}

function loadDesign() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.schemaVersion === SCHEMA_VERSION) return s;
    // (migrate() af ældre versioner kommer i en senere fase)
  } catch (e) { /* korrupt */ }
  return defaultDesign();
}

// --- Materialebibliotek ---
export function addMaterial(mat) {
  const id = 'user-' + Date.now().toString(36);
  const entry = { ...mat, id, builtin: false };
  design.library.push(entry);
  commit();
  return entry;
}

export function removeMaterial(id) {
  const m = design.library.find(x => x.id === id);
  if (!m || m.builtin) return false;          // byg-ind materialer kan ikke slettes
  design.library = design.library.filter(x => x.id !== id);
  // skift væk fra et slettet materiale i analyserne
  for (const scope of ['post', 'bar']) {
    if (design.analysis[scope].materialId === id) {
      design.analysis[scope].materialId = design.library[0].id;
    }
  }
  commit();
  return true;
}
