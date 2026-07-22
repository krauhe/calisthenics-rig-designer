// Delt materiale-kontrol brugt af både stolpe- og bar-fanen:
// vælg fra biblioteket, tilføj egne standardmaterialer, slet egne.


function matLabel(m, dimUnit, lang) {
  if (m.kind === 'wood') return `${m.name} · ${fmtDim(m.side, dimUnit, lang)}`;
  return `${m.name} · Ø ${fmtDim(m.od, dimUnit, lang)} · ${t('mat.wall', lang)} ${fmtDim(m.wall, dimUnit, lang, dimUnit === 'in' ? 3 : 1)}`;
}

function materialControl(ctx, scope) {
  const { design, store, lang, rerender } = ctx;
  const tt = k => ctx.t(k, lang);
  const dimUnit = design.units[scope].dim;
  const current = resolveMaterial(design, design.analysis[scope].materialId);

  const sel = select(
    sortLibrary(design.library).map(m => [m.id, matLabel(m, dimUnit, lang)]),
    current.id,
    id => store.update(d => {
      d.analysis[scope].materialId = id;
      if (scope === 'post') {
        const mat = resolveMaterial(d, id);
        const minHole = mat.kind === 'wood' ? mat.side : mat.od;
        d.analysis.post.hole_mm = Math.max(d.analysis.post.hole_mm, minHole);
      }
    }) || rerender());

  // Stolpe- og Bar-fanerne er KUN til analyse — materialer oprettes/redigeres
  // ikke her; man vælger blot fra biblioteket (alt designes på Kort).
  return el('div', { class: 'matctl' },
    el('div', { class: 'matctl-row' }, sel));
}
