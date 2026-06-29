// Delt materiale-kontrol brugt af både stolpe- og bar-fanen:
// vælg fra biblioteket, tilføj egne standardmaterialer, slet egne.


function matLabel(m, dimUnit, lang) {
  if (m.kind === 'wood') return `${m.name} · ${fmtDim(m.side, dimUnit, lang)}`;
  return `${m.name} · Ø ${fmtDim(m.od, dimUnit, lang)}`;
}

const DEFAULTS = {
  pipe: { E: 210e9, sRe: 195e6, sRm: 320e6, od: 33.7, wall: 3.2 },
  wood: { E: 10e9,  sRe: 10e6,  sRm: 24e6,  side: 100 },
};

function materialControl(ctx, scope) {
  const { design, store, lang, rerender } = ctx;
  const tt = k => ctx.t(k, lang);
  const dimUnit = design.units[scope].dim;
  const current = resolveMaterial(design, design.analysis[scope].materialId);

  const sel = select(
    design.library.map(m => [m.id, matLabel(m, dimUnit, lang)]),
    current.id,
    id => store.update(d => { d.analysis[scope].materialId = id; }) || rerender());

  const form = el('div', { class: 'matform', style: 'display:none' });
  const addBtn = el('button', { class: 'btn-sm', type: 'button',
    onclick: () => { form.style.display = form.style.display === 'none' ? 'block' : 'none';
                     if (form.style.display === 'block') buildForm(); } }, tt('mat.add'));

  const delBtn = !current.builtin
    ? el('button', { class: 'btn-sm danger', type: 'button',
        onclick: () => { store.removeMaterial(current.id); rerender(); } }, tt('mat.delete'))
    : null;

  function buildForm() {
    clear(form);
    let kind = 'pipe';
    const nameInp = el('input', { type: 'text', placeholder: tt('mat.name'), value: '' });
    const dimsWrap = el('div', { class: 'matform-dims' });

    const renderDims = () => {
      clear(dimsWrap);
      if (kind === 'pipe') {
        dimsWrap.append(
          labeled(tt('mat.od') + ' (mm)', el('input', { type: 'number', step: '0.1', value: '33.7', id: 'mf-od' })),
          labeled(tt('mat.wall') + ' (mm)', el('input', { type: 'number', step: '0.1', value: '3.2', id: 'mf-wall' })));
      } else {
        dimsWrap.append(
          labeled(tt('mat.side') + ' (mm)', el('input', { type: 'number', step: '1', value: '100', id: 'mf-side' })));
      }
    };

    const kindSel = select([['pipe', tt('mat.kind.pipe')], ['wood', tt('mat.kind.wood')]], kind,
      v => { kind = v; renderDims(); });
    renderDims();

    const save = el('button', { class: 'btn-sm primary', type: 'button', onclick: () => {
      const name = nameInp.value.trim() || (kind === 'pipe' ? 'Rør' : 'Træ');
      const base = { name, kind, E: DEFAULTS[kind].E, sRe: DEFAULTS[kind].sRe, sRm: DEFAULTS[kind].sRm };
      const mat = kind === 'pipe'
        ? { ...base, od: numVal('mf-od', 33.7), wall: numVal('mf-wall', 3.2) }
        : { ...base, side: numVal('mf-side', 100) };
      const entry = store.addMaterial(mat);
      store.update(d => { d.analysis[scope].materialId = entry.id; });
      rerender();
    } }, tt('mat.save'));
    const cancel = el('button', { class: 'btn-sm', type: 'button',
      onclick: () => { form.style.display = 'none'; } }, tt('mat.cancel'));

    form.append(
      labeled(tt('mat.name'), nameInp),
      labeled(tt('mat.kind'), kindSel),
      dimsWrap,
      el('div', { class: 'matform-act' }, save, cancel));
  }

  return el('div', { class: 'matctl' },
    el('div', { class: 'matctl-row' }, sel, delBtn),
    el('div', { class: 'matctl-row' }, addBtn),
    form);
}

function labeled(text, input) {
  return el('label', { class: 'mf-fld' }, el('span', {}, text), input);
}
function numVal(id, fallback) {
  const v = parseFloat((document.getElementById(id) || {}).value);
  return isNaN(v) ? fallback : v;
}
