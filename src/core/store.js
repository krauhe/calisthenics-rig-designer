// Tilstands-container: holder design-objektet, gemmer automatisk i localStorage,
// og giver besked til abonnenter ved ændringer.


const KEY = 'calisthenics-rig-designer';

let design = loadDesign();
const subs = new Set();
let saveTimer = null;

function getDesign() { return design; }

function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

// Kald efter en ændring i design: notificér + gem (debounced).
function commit() {
  design.meta.modified = Date.now();
  subs.forEach(fn => fn(design));
  scheduleSave();
}

// Bekvem helper: muter design og commit i ét.
function update(mutator) { mutator(design); commit(); }

// Erstat hele designet (fx ved fil-load eller "Ny tegning").
function replace(newDesign) { design = newDesign; commit(); }

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(design)); } catch (e) { /* fuld/privat */ }
  }, 300);
}

function loadDesign() {
  // 1) nuværende v2-tegning (migreres/udfyldes via adopt)
  try {
    const cur = localStorage.getItem(KEY);
    if (cur) return adopt(JSON.parse(cur));
  } catch (e) { /* korrupt — prøv næste */ }
  // 2) importér automatisk fra den oprindelige app, hvis den findes
  try {
    const old = localStorage.getItem(LEGACY_KEY);
    if (old) return adopt(JSON.parse(old));
  } catch (e) { /* ignorér */ }
  return defaultDesign();
}

// --- Materialebibliotek ---
function addMaterial(mat) {
  const id = 'user-' + Date.now().toString(36);
  const entry = { ...mat, id, builtin: false };
  design.library.push(entry);
  commit();
  return entry;
}

function removeMaterial(id) {
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
