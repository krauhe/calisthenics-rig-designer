// Tilstands-container: holder design-objektet, gemmer automatisk i localStorage,
// og fører fortryd/gentag-historikken.


const KEY = 'calisthenics-rig-designer';

let design = loadDesign();
let saveTimer = null;

// Fortryd/gentag: stak af serialiserede tilstande (top = nuværende tilstand).
const HISTORY_MAX = 80;
// Commits tættere på hinanden end dette koalesceres til ÉT fortryd-trin, så
// fx at skrive et navn ikke giver ét trin pr. tastetryk.
const COALESCE_MS = 800;
let undoStack = [JSON.stringify(design)];
let redoStack = [];
let lastCommitAt = 0;

function getDesign() { return design; }

// Kald efter en ændring i design: opdatér historik + gem (debounced).
function commit() {
  design.meta.modified = Date.now();
  const snap = JSON.stringify(design);
  const now = Date.now();
  if (now - lastCommitAt < COALESCE_MS && undoStack.length > 1) {
    undoStack[undoStack.length - 1] = snap;   // samme "skrive-burst" → erstat toppen
  } else {
    undoStack.push(snap);
    if (undoStack.length > HISTORY_MAX) undoStack.shift();
  }
  lastCommitAt = now;
  redoStack = [];
  scheduleSave();
}

// Forsøg at parse + validere/normalisere en stak-post via adopt(). Ved fejl:
// advar og returnér null, så kaldstedet kan afbryde uden at installere et ødelagt design.
function restoreFromStack(entry) {
  try {
    return adopt(JSON.parse(entry));
  } catch (e) {
    console.warn('Fortryd/gentag fejlede (ugyldig tilstand):', e);
    return null;
  }
}

// Gendan forrige tilstand (commit-niveau). Returnerer true hvis der skete noget.
function undo() {
  if (undoStack.length < 2) return false;
  const restored = restoreFromStack(undoStack[undoStack.length - 2]); // forrige tilstand
  if (!restored) return false;
  redoStack.push(undoStack.pop());                       // nuværende → gentag
  design = restored;
  lastCommitAt = 0;                                      // næste commit må ikke koalescere hen over et fortryd
  scheduleSave();
  return true;
}

function redo() {
  if (!redoStack.length) return false;
  const s = redoStack[redoStack.length - 1];
  const restored = restoreFromStack(s);
  if (!restored) return false;
  redoStack.pop();
  undoStack.push(s);
  design = restored;
  lastCommitAt = 0;
  scheduleSave();
  return true;
}

// Bekvem helper: muter design og commit i ét.
function update(mutator) { mutator(design); commit(); }

// Erstat hele designet (fx ved fil-load eller "Ny tegning").
function replace(newDesign) { design = newDesign; commit(); }

function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try { localStorage.setItem(KEY, JSON.stringify(design)); } catch (e) { console.warn('Autosave fejlede (localStorage):', e); }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 300);
}

// Debounce må ikke koste den sidste ændring, hvis fanen lukkes med det samme.
if (typeof addEventListener === 'function') {
  addEventListener('pagehide', () => { if (saveTimer) flushSave(); });
}

function loadDesign() {
  // 1) nuværende v2-tegning (migreres/udfyldes via adopt)
  try {
    const cur = localStorage.getItem(KEY);
    if (cur) return adopt(JSON.parse(cur));
  } catch (e) {
    // Korrupt/uparsbar tegning: læg en backup-kopi til side FØR næste autosave
    // overskriver den — så data kan reddes manuelt.
    console.warn('Gemt tegning kunne ikke indlæses — backup lagt under "' + KEY + '-corrupt":', e);
    try {
      const cur = localStorage.getItem(KEY);
      if (cur && !localStorage.getItem(KEY + '-corrupt')) localStorage.setItem(KEY + '-corrupt', cur);
    } catch (_) { /* localStorage fuld/utilgængelig — kan ikke reddes */ }
  }
  // 2) importér automatisk fra den oprindelige app, hvis den findes
  try {
    const old = localStorage.getItem(LEGACY_KEY);
    if (old) return adopt(JSON.parse(old));
  } catch (e) { /* ignorér */ }
  return defaultDesign();
}
