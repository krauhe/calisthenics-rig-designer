// Fil-bjælke: navngiv, gem til fil, hent fil, ny tegning.
// Ren klient-side I/O — ingen server, virker offline.


function fileBar(ctx) {
  const { design, store } = ctx;
  const tt = k => ctx.t(k, ctx.lang);

  const nameInp = el('input', { type: 'text', class: 'name-inp', value: design.meta.name || '', title: tt('file.name') });
  nameInp.addEventListener('input', () => store.update(d => { d.meta.name = nameInp.value; }));

  const fileInput = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = deserialize(String(r.result));
        store.replace(d);
        ctx.rerenderAll();
      } catch (e) {
        alert(tt('file.error'));
      }
    };
    r.readAsText(f);
    fileInput.value = '';
  });

  function doSave() {
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

  // Forslags-/skabelon-vælger: erstatter tegningen med en færdig rig.
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

  return el('div', { class: 'filebar' },
    nameInp,
    el('button', { class: 'btn-sm', type: 'button', onclick: doSave }, tt('file.save')),
    el('button', { class: 'btn-sm', type: 'button', onclick: () => fileInput.click() }, tt('file.load')),
    el('button', { class: 'btn-sm', type: 'button', onclick: doNew }, tt('file.new')),
    presetSel,
    fileInput);
}
