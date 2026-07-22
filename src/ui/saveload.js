// Fil-bjælke: navngiv, gem/åbn i browseren (flere tegninger), eksportér/
// importér .json-filer, ny tegning, forslag og print.
// Ren klient-side I/O — ingen server, virker offline.

const SAVED_KEY = 'crd-saved-designs';

function readSaved() {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY));
    return Array.isArray(v) ? v : [];
  } catch (_) { return []; }
}

function writeSaved(list) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); return true; }
  catch (e) { console.warn('Kunne ikke gemme tegning (localStorage):', e); alert('⚠ ' + e.message); return false; }
}

function fileBar(ctx) {
  const { design, store } = ctx;
  const tt = k => ctx.t(k, ctx.lang);

  const nameInp = el('input', { type: 'text', class: 'name-inp', value: design.meta.name || '', title: tt('file.name'), 'aria-label': tt('file.name') });
  nameInp.addEventListener('input', () => store.update(d => { d.meta.name = nameInp.value; }));

  // Skeln "filen er fra en nyere appversion" fra "ugyldig fil" i fejlbeskeden.
  const importError = e => alert(tt(e && e.message === 'newer-schema' ? 'file.errorNewer' : 'file.error'));

  const fileInput = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = deserialize(String(r.result));
        if (typeof tabSite !== 'undefined') tabSite.fitNext = true;   // tilpas kortet til den importerede rig
        store.replace(d);
        ctx.rerenderAll();
      } catch (e) {
        importError(e);
      }
    };
    r.onerror = () => alert(tt('file.error'));
    r.readAsText(f);
    fileInput.value = '';
  });

  // ---- Eksport: download som .json-fil (til deling/backup) ----
  function doExport() {
    const blob = new Blob([serialize(store.getDesign())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const name = (store.getDesign().meta.name || 'rig').replace(/[^\wæøåÆØÅ \-]/g, '').trim() || 'rig';
    const a = el('a', { href: url, download: name + '.json' });
    document.body.append(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function doNew() {
    if (confirm(tt('file.newConfirm'))) { store.replace(defaultDesign()); ctx.rerenderAll(); }
  }

  // ---- Gem/Åbn i browseren: flere navngivne tegninger (localStorage) ----
  function doSaveLocal() {
    const d = store.getDesign();
    const name = (d.meta.name || '').trim() || 'rig';
    const existing = readSaved();
    if (existing.some(s => s.name === name) && !confirm(`${tt('file.overwriteConfirm')} "${name}"?`)) return;
    const list = existing.filter(s => s.name !== name);
    list.unshift({ name, savedAt: Date.now(), data: serialize(d) });
    if (writeSaved(list)) {
      saveBtn.textContent = '✓ ' + tt('file.savedAs') + ' "' + name + '"';
      setTimeout(() => { saveBtn.textContent = tt('file.saveLocal'); }, 1600);
    }
  }

  let menu = null;
  function closeMenu() {
    if (!menu) return;
    menu.remove(); menu = null;
    document.removeEventListener('pointerdown', onDocDown, true);
    document.removeEventListener('keydown', onMenuKeyDown);
    openBtn.setAttribute('aria-expanded', 'false');
  }
  function onDocDown(e) { if (menu && !menu.contains(e.target) && e.target !== openBtn) closeMenu(); }
  function onMenuKeyDown(e) {
    if (e.key !== 'Escape' || !menu) return;
    e.preventDefault(); closeMenu(); openBtn.focus();
  }
  function toggleMenu() {
    if (menu) { closeMenu(); return; }
    const list = readSaved();
    menu = el('div', { class: 'save-menu', role: 'menu' });
    if (!list.length) menu.append(el('div', { class: 'save-menu-empty' }, tt('file.noSaved')));
    list.forEach(s => {
      const when = new Date(s.savedAt || 0);
      const row = el('div', { class: 'save-menu-row' },
        el('button', { class: 'save-menu-name', type: 'button', role: 'menuitem', title: when.toLocaleString() },
          s.name, el('span', { class: 'save-menu-date' }, when.toLocaleDateString())),
        el('button', { class: 'save-menu-del', type: 'button', role: 'menuitem', title: `${tt('file.deleteConfirm')} "${s.name}"`, 'aria-label': `${tt('file.deleteConfirm')} "${s.name}"` }, '×'));
      row.querySelector('.save-menu-name').addEventListener('click', () => {
        if (!confirm(`${tt('file.openConfirm')}\n\n"${s.name}"`)) return;
        try {
          const d = deserialize(s.data);
          closeMenu();
          if (typeof tabSite !== 'undefined') tabSite.fitNext = true;
          store.replace(d);
          ctx.rerenderAll();
        } catch (e) { importError(e); }
      });
      row.querySelector('.save-menu-del').addEventListener('click', () => {
        if (!confirm(`${tt('file.deleteConfirm')} "${s.name}"?`)) return;
        writeSaved(readSaved().filter(x => x.name !== s.name));
        closeMenu(); toggleMenu();   // gentegn menuen
      });
      menu.append(row);
    });
    openBtn.parentElement.append(menu);
    const r = openBtn.getBoundingClientRect(), pr = openBtn.parentElement.getBoundingClientRect();
    menu.style.left = (r.left - pr.left) + 'px';
    menu.style.top = (r.bottom - pr.top + 4) + 'px';
    openBtn.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', onDocDown, true);
    document.addEventListener('keydown', onMenuKeyDown);
  }

  // ---- Forslags-/skabelon-vælger: erstatter tegningen med en færdig rig ----
  const presetSel = el('select', { class: 'btn-sm', title: tt('file.presetHint') });
  presetSel.append(el('option', { value: '' }, tt('file.preset')));
  presetList().forEach(p => presetSel.append(el('option', { value: p.id }, tt(p.nameKey))));
  presetSel.addEventListener('change', () => {
    const id = presetSel.value; presetSel.value = '';
    if (!id) return;
    if (!confirm(tt('file.newConfirm'))) return;
    const p = presetList().find(x => x.id === id);
    const d = buildPreset(id);
    if (p) d.meta.name = tt(p.nameKey);
    if (typeof tabSite !== 'undefined') tabSite.fitNext = true;   // tilpas zoom til den nye rig
    store.replace(d);
    if (ctx.openTab) ctx.openTab('site');
    ctx.rerenderAll();
  });

  const saveBtn = el('button', { class: 'btn-sm', type: 'button', title: tt('file.saveLocalHint'), onclick: doSaveLocal }, tt('file.saveLocal'));
  const openBtn = el('button', { class: 'btn-sm', type: 'button', title: tt('file.openLocalHint'), 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: toggleMenu }, tt('file.openLocal'));

  return el('div', { class: 'filebar' },
    nameInp,
    saveBtn,
    openBtn,
    el('span', { class: 'filebar-sep' }),
    el('button', { class: 'btn-sm', type: 'button', title: tt('file.saveHint'), onclick: doExport }, tt('file.save')),
    el('button', { class: 'btn-sm', type: 'button', title: tt('file.loadHint'), onclick: () => fileInput.click() }, tt('file.load')),
    el('button', { class: 'btn-sm', type: 'button', onclick: doNew }, tt('file.new')),
    presetSel,
    el('button', { class: 'btn-sm', type: 'button', title: tt('file.printHint'), onclick: () => printGuide(ctx) }, '🖨 ' + tt('file.print')),
    fileInput);
}
