// Fil-bjælke: navngiv, gem til fil, hent fil, ny tegning.
// Ren klient-side I/O — ingen server, virker offline.

import { el } from './dom.js';
import { serialize, deserialize } from '../core/schema.js';
import { defaultDesign } from '../core/model.js';

export function fileBar(ctx) {
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

  return el('div', { class: 'filebar' },
    nameInp,
    el('button', { class: 'btn-sm', type: 'button', onclick: doSave }, tt('file.save')),
    el('button', { class: 'btn-sm', type: 'button', onclick: () => fileInput.click() }, tt('file.load')),
    el('button', { class: 'btn-sm', type: 'button', onclick: doNew }, tt('file.new')),
    fileInput);
}
