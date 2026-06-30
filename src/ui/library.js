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
    sortLibrary(design.library).map(m => [m.id, matLabel(m, dimUnit, lang)]),
    current.id,
    id => store.update(d => { d.analysis[scope].materialId = id; }) || rerender());

  // Stolpe- og Bar-fanerne er KUN til analyse — materialer oprettes/redigeres
  // ikke her; man vælger blot fra biblioteket (alt designes på Kort).
  return el('div', { class: 'matctl' },
    el('div', { class: 'matctl-row' }, sel));
}

function labeled(text, input) {
  return el('label', { class: 'mf-fld' }, el('span', {}, text), input);
}
function numVal(id, fallback) {
  const v = parseFloat((document.getElementById(id) || {}).value);
  return isNaN(v) ? fallback : v;
}
