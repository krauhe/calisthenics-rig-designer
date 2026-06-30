// Fane: Stolpe-analyse. Bruger foundation() fra kernen.


const tabPost = {
  id: 'post',
  labelKey: 'tab.post',
  render(container, ctx) {
    const { design, store, lang, rerender } = ctx;
    const a = design.analysis.post;
    const u = design.units.post;
    const tt = k => ctx.t(k, lang);
    const lenTxt = tt(u.len === 'ft' ? 'unit.ft' : 'unit.m');
    const dimTxt = tt(u.dim === 'in' ? 'unit.in' : 'unit.mm');

    const set = mut => { store.update(mut); compute(); };
    const results = el('div', { class: 'results' });
    const chartHost = el('div', { class: 'charthost' });

    // Hullets sidemål kan ikke være mindre end stolpens sidemål/diameter.
    const matPost = resolveMaterial(design, a.materialId);
    const postSideMm = matPost.kind === 'wood' ? matPost.side : matPost.od;
    if (a.hole_mm < postSideMm) a.hole_mm = postSideMm;
    const holeToMm = v => u.dim === 'in' ? v * 25.4 : v * 10;
    const holeFromMm = mm => Math.round((u.dim === 'in' ? mm / 25.4 : mm / 10) * 100) / 100;
    const holeInp = el('input', { type: 'number', step: u.dim === 'in' ? '0.5' : '1',
      min: String(holeFromMm(postSideMm)), value: String(holeFromMm(a.hole_mm)) });
    holeInp.addEventListener('input', () => {
      const v = parseFloat(holeInp.value); if (isNaN(v)) return;
      set(d => { d.analysis.post.hole_mm = Math.max(holeToMm(v), postSideMm); });
    });
    holeInp.addEventListener('change', () => {
      holeInp.value = String(holeFromMm(Math.max(holeToMm(parseFloat(holeInp.value) || 0), postSideMm)));
    });

    const inputs = el('div', { class: 'panel analysis-card' },
      el('div', { class: 'unit-row' },
        unitToggle(tt('units.length'), [['m', tt('unit.m')], ['ft', tt('unit.ft')]], u.len,
          v => { store.update(d => { d.units.post.len = v; }); rerender(); }),
        unitToggle(tt('units.section'), [['mm', tt('unit.mm')], ['in', tt('unit.in')]], u.dim,
          v => { store.update(d => { d.units.post.dim = v; }); rerender(); })),
      el('div', { class: 'mat-block' },
        el('span', { class: 'fld-l' }, tt('mat.title')),
        materialControl(ctx, 'post')),
      field(`${tt('post.depth')} (${lenTxt})`, lenInput(a.depth_m, u.len, v => set(d => { d.analysis.post.depth_m = Math.max(v, 0); }), { minSI: 0 })),
      field(`${tt('post.hole')} (${u.dim === 'in' ? tt('unit.in') : 'cm'})`, holeInp,
        `${tt('post.holeMin')}: ${holeFromMm(postSideMm)} ${u.dim === 'in' ? tt('unit.in') : 'cm'}`),
      field(`${tt('post.height')} (${lenTxt})`, lenInput(a.height_m, u.len, v => set(d => { d.analysis.post.height_m = Math.max(v, 0); }), { minSI: 0 })));

    function resRow(label, value, cls) {
      return el('div', { class: 'res' + (cls ? ' ' + cls : '') },
        el('span', { class: 'res-l' }, label), el('span', { class: 'res-v' }, value));
    }

    function compute() {
      const mat = resolveMaterial(design, a.materialId);
      const postSide = (mat.kind === 'wood' ? mat.side : mat.od) / 1000;
      const Ipost = sectionProps(mat).I;
      const f = foundation({ postSide, depth: a.depth_m, hole: a.hole_mm / 1000, topHeight: a.height_m, Ipost, E: mat.E });
      const swayMm = f.dTop * 1000;
      const feelKey = swayMm < 10 ? 'feel.solid' : swayMm < 20 ? 'feel.springy' : 'feel.soft';
      results.className = 'results analysis-card result-' + (swayMm < 10 ? 'ok' : swayMm < 20 ? 'warn' : 'bad');
      clear(results);
      results.append(
        el('h3', {}, tt('post.res.title')),
        resRow(tt('post.res.stiffness'), `${fmt(f.kLat / 1000, 1, lang)} N/mm`),
        resRow(tt('post.res.swayPost'), fmtDispl(f.dBend * 1000, u.dim, lang)),
        resRow(tt('post.res.swayBase'), fmtDispl(f.dRot * 1000, u.dim, lang)),
        resRow(`${tt('post.res.swaySum')} (${tt('post.res.sway1')})`, fmtDispl(swayMm, u.dim, lang), 'big'),
        resRow('', `${fmtDispl(swayMm / 2, u.dim, lang)} (${tt('post.res.sway2')})`),
        resRow(tt('post.res.rot'), `${Math.round(f.Ktheta / 1000)} kNm/rad`),
        resRow(tt('post.res.feel'), tt(feelKey)));

      // graf: sving som funktion af nedgravningsdybde — opdelt i de tre dele
      const depths = [];
      for (let dp = 0.4; dp <= 2.0 + 1e-9; dp += 0.1) depths.push(Math.round(dp * 10) / 10);
      const inch = u.dim === 'in';
      const cv = v => inch ? v / 25.4 : v;
      const sSum = [], sBend = [], sRot = [];
      depths.forEach(dp => {
        const ff = foundation({ postSide, depth: dp, hole: a.hole_mm / 1000, topHeight: a.height_m, Ipost, E: mat.E });
        sSum.push({ x: dp, y: cv(ff.dTop * 1000) });
        sBend.push({ x: dp, y: cv(ff.dBend * 1000) });
        sRot.push({ x: dp, y: cv(ff.dRot * 1000) });
      });
      // Fast y-akse (uafhængig af hullet), så stolpe-elasticitet-linjen IKKE
      // ser ud til at flytte sig når man kun ændrer hullet — kun fundament-
      // og sum-linjen reagerer på hullet. Skaleres efter et fast referencehul.
      const yRef = foundation({ postSide, depth: 0.4, hole: 0.30, topHeight: a.height_m, Ipost, E: mat.E });
      const yMax = Math.max(cv(yRef.dTop * 1000), ...sBend.map(p => p.y)) * 1.12;
      const series = [
        { points: sSum, color: COLORS[0] },   // sum (blå)
        { points: sBend, color: COLORS[1] },  // stolpe-elasticitet (grøn)
        { points: sRot, color: COLORS[2] },   // fundament-eftergivenhed (orange)
      ];
      const swatch = (c, label) => `<span class="leg-item"><span class="leg-sw" style="background:${c}"></span>${label}</span>`;
      chartHost.innerHTML = `<div class="chart-title">${tt('post.chart.title')}</div>` +
        lineChart({ series, xMin: 0.4, xMax: 2.0, yMax, xLabel: tt('post.chart.x'),
          yLabel: tt('post.chart.y') + (inch ? ' (in)' : ' (mm)'), vLine: a.depth_m, hLine: cv(swayMm), lang }) +
        `<div class="legend">${swatch(COLORS[0], tt('post.res.swaySum'))}${swatch(COLORS[1], tt('post.res.swayPost'))}${swatch(COLORS[2], tt('post.res.swayBase'))}</div>`;
    }

    compute();
    container.append(
      el('h2', {}, tt('post.heading')),
      el('p', { class: 'intro' }, tt('post.intro')),
      el('div', { class: 'twocol analysis-layout' },
        inputs,
        el('div', { class: 'analysis-output analysis-output-post' }, results, chartHost)));
  },
};
