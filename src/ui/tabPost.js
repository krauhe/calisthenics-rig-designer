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

    const inputs = el('div', { class: 'panel' },
      el('div', { class: 'unit-row' },
        unitToggle(tt('units.length'), [['m', tt('unit.m')], ['ft', tt('unit.ft')]], u.len,
          v => { store.update(d => { d.units.post.len = v; }); rerender(); }),
        unitToggle(tt('units.section'), [['mm', tt('unit.mm')], ['in', tt('unit.in')]], u.dim,
          v => { store.update(d => { d.units.post.dim = v; }); rerender(); })),
      el('div', { class: 'mat-block' },
        el('span', { class: 'fld-l' }, tt('mat.title')),
        materialControl(ctx, 'post')),
      field(`${tt('post.depth')} (${lenTxt})`, lenInput(a.depth_m, u.len, v => set(d => { d.analysis.post.depth_m = v; }))),
      field(`${tt('post.hole')} (${u.dim === 'in' ? tt('unit.in') : 'cm'})`,
        numInput(
          Math.round((u.dim === 'in' ? a.hole_mm / 25.4 : a.hole_mm / 10) * 100) / 100,
          u.dim === 'in' ? 0.5 : 1,
          v => set(d => { d.analysis.post.hole_mm = u.dim === 'in' ? v * 25.4 : v * 10; }))),
      field(`${tt('post.height')} (${lenTxt})`, lenInput(a.height_m, u.len, v => set(d => { d.analysis.post.height_m = v; }))));

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

      // graf: sving som funktion af nedgravningsdybde
      const depths = [];
      for (let dp = 0.4; dp <= 2.0 + 1e-9; dp += 0.1) depths.push(Math.round(dp * 10) / 10);
      const inch = u.dim === 'in';
      const cv = v => inch ? v / 25.4 : v;
      const pts = depths.map(dp => ({
        x: dp,
        y: cv(foundation({ postSide, depth: dp, hole: a.hole_mm / 1000, topHeight: a.height_m, Ipost, E: mat.E }).dTop * 1000),
      }));
      const yMax = Math.max(...pts.map(p => p.y)) * 1.1;
      chartHost.innerHTML = `<div class="chart-title">${tt('post.chart.title')}</div>` +
        lineChart({ points: pts, xMin: 0.4, xMax: 2.0, yMax, xLabel: tt('post.chart.x'),
          yLabel: tt('post.chart.y') + (inch ? ' (in)' : ' (mm)'), vLine: a.depth_m, hLine: cv(swayMm), lang });
    }

    compute();
    container.append(
      el('h2', {}, tt('post.heading')),
      el('p', { class: 'intro' }, tt('post.intro')),
      el('div', { class: 'twocol' }, inputs, el('div', {}, results, chartHost)));
  },
};
