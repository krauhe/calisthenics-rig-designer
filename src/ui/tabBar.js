// Tab: bar analysis. Uses beam() from the core and keeps all charts tied to
// the selected material, span, load and end fixity.

const tabBar = {
  id: 'bar',
  labelKey: 'tab.bar',
  render(container, ctx) {
    const { design, store, lang, rerender } = ctx;
    const a = design.analysis.bar;
    const u = design.units.bar;
    const tt = k => ctx.t(k, lang);
    const lenTxt = tt(u.len === 'ft' ? 'unit.ft' : 'unit.m');
    const massU = u.mass || 'kg';
    const massTxt = massU === 'lb' ? 'lbs' : 'kg';
    const inch = u.dim === 'in';
    const cvDim = v => inch ? v / 25.4 : v;

    const set = mut => { store.update(mut); compute(); };
    const results = el('div', { class: 'results' });
    const deflHost = el('div', { class: 'charthost' });
    const workHost = el('div', { class: 'charthost' });
    const chartHost = el('div', { class: 'charthost' });
    const legend = el('div', { class: 'legend' });

    const MIN_SPAN = 0.1;
    if (!(a.span_m >= MIN_SPAN)) a.span_m = MIN_SPAN;
    a.fixity = Math.min(1, Math.max(0, a.fixity));
    const spanToSI = v => lenToSI(v, u.len);
    const spanFromSI = m => round(lenFromSI(m, u.len));
    const spanInp = el('input', {
      type: 'number',
      step: u.len === 'ft' ? '0.1' : '0.05',
      min: String(spanFromSI(MIN_SPAN)),
      value: String(spanFromSI(a.span_m)),
    });
    spanInp.addEventListener('input', () => {
      const v = parseFloat(spanInp.value); if (isNaN(v)) return;
      set(d => { d.analysis.bar.span_m = Math.max(spanToSI(v), MIN_SPAN); });
    });
    spanInp.addEventListener('change', () => {
      spanInp.value = String(spanFromSI(Math.max(spanToSI(parseFloat(spanInp.value) || 0), MIN_SPAN)));
    });

    const fixInp = el('input', { type: 'number', step: '0.05', min: '0', max: '1', value: String(a.fixity) });
    fixInp.addEventListener('input', () => {
      const v = parseFloat(fixInp.value); if (isNaN(v)) return;
      set(d => { d.analysis.bar.fixity = Math.min(1, Math.max(0, v)); });
    });
    fixInp.addEventListener('change', () => {
      fixInp.value = String(Math.min(1, Math.max(0, parseFloat(fixInp.value) || 0)));
    });

    const inputs = el('div', { class: 'panel analysis-card' },
      el('div', { class: 'unit-row' },
        unitToggle(tt('units.length'), [['m', tt('unit.m')], ['ft', tt('unit.ft')]], u.len,
          v => { store.update(d => { d.units.bar.len = v; }); rerender(); }),
        unitToggle(tt('units.section'), [['mm', tt('unit.mm')], ['in', tt('unit.in')]], u.dim,
          v => { store.update(d => { d.units.bar.dim = v; }); rerender(); }),
        unitToggle(tt('units.mass'), [['kg', tt('unit.kg')], ['lb', tt('unit.lb')]], massU,
          v => { store.update(d => { d.units.bar.mass = v; }); rerender(); })),
      el('div', { class: 'mat-block' },
        el('span', { class: 'fld-l' }, tt('mat.title')),
        materialControl(ctx, 'bar')),
      field(`${tt('bar.span')} (${lenTxt})`, spanInp),
      field(`${tt('bar.load')} (${massTxt})`,
        numInput(Math.round(massFromSI(a.load_kg, massU)), massU === 'lb' ? 10 : 5,
          v => set(d => { d.analysis.bar.load_kg = Math.max(massToSI(v, massU), 0); }), { min: 0 }),
        tt('bar.load.hint')),
      field(`${tt('bar.fixity')}`, fixInp, tt('bar.fixity.hint')));

    function resRow(label, value, cls) {
      return el('div', { class: 'res' + (cls ? ' ' + cls : '') },
        el('span', { class: 'res-l' }, label),
        el('span', { class: 'res-v' }, value));
    }

    function compute() {
      const mat = resolveMaterial(design, a.materialId);
      const b = beam(a.span_m, mat, a.load_kg, a.fixity);
      const deflMm = b.dReal * 1000;
      const feelKey = deflMm < 7 ? 'feel.solid' : deflMm < 12 ? 'feel.springy' : 'feel.soft';
      results.className = 'results analysis-card result-' + (b.pYield >= a.load_kg * 1.2 ? 'ok' : b.pYield >= a.load_kg ? 'warn' : 'bad');
      clear(results);
      results.append(
        el('h3', {}, tt('post.res.title')),
        resRow(`${tt('bar.res.deflection')} (${fmtMass(a.load_kg, massU, lang)})`, fmtDispl(deflMm, u.dim, lang), 'big'),
        resRow(tt('post.res.feel'), tt(feelKey)),
        resRow(tt('bar.res.yield'), fmtMass(b.pYield, massU, lang)),
        resRow(tt('bar.res.ultimate'), fmtMass(b.pUlt, massU, lang)),
        el('div', { class: 'res-note' }, tt('bar.res.note')));

      const maxLoadKg = Math.max(200, a.load_kg * 1.15);
      const loads = [];
      for (let i = 0; i <= 20; i++) loads.push(maxLoadKg * i / 20);
      const deflPoints = loads.map(Lk => ({
        x: massFromSI(Lk, massU),
        y: cvDim(beam(a.span_m, mat, Lk, a.fixity).dReal * 1000),
      }));
      const deflYMax = Math.max(cvDim(deflMm), ...deflPoints.map(p => p.y), 0.01) * 1.18;
      deflHost.innerHTML = `<div class="chart-title">${tt('bar.chart2.title')} - ${esc(mat.name)}</div>` +
        lineChart({
          points: deflPoints,
          xMin: 0,
          xMax: massFromSI(maxLoadKg, massU),
          yMax: deflYMax,
          xLabel: `${tt('bar.chart2.x')} (${massTxt})`,
          yLabel: `${tt('bar.chart2.y')} (${inch ? 'in' : 'mm'})`,
          vLine: massFromSI(a.load_kg, massU),
          hLine: cvDim(deflMm),
          lang,
        });

      clear(legend);
      legend.append(
        el('span', { class: 'leg-item' }, el('span', { class: 'leg-sw', style: `background:${COLORS[0]}` }), mat.name),
        el('span', { class: 'leg-item' }, el('span', { class: 'leg-sw', style: 'background:#ff6f66' }), fmtMass(a.load_kg, massU, lang)));

      const spanMin = Math.max(MIN_SPAN, Math.min(0.5, a.span_m * 0.6));
      const spanMax = Math.max(3.0, a.span_m * 1.5, spanMin + 0.8);
      const spans = [];
      for (let i = 0; i <= 30; i++) spans.push(spanMin + (spanMax - spanMin) * i / 30);
      const safePoints = spans.map(s => ({
        x: lenFromSI(s, u.len),
        y: massFromSI(beam(s, mat, 1, a.fixity).pYield, massU),
      }));
      const ultPoints = spans.map(s => ({
        x: lenFromSI(s, u.len),
        y: massFromSI(beam(s, mat, 1, a.fixity).pUlt, massU),
      }));
      const currentX = lenFromSI(a.span_m, u.len);
      const currentLoad = massFromSI(a.load_kg, massU);
      const capYMax = pts => Math.max(currentLoad, ...pts.map(p => p.y), 1) * 1.12;

      workHost.innerHTML = `<div class="chart-title">${tt('bar.chart.titleWork')} - ${esc(mat.name)}</div>` +
        lineChart({
          points: safePoints,
          xMin: lenFromSI(spanMin, u.len),
          xMax: lenFromSI(spanMax, u.len),
          yMax: capYMax(safePoints),
          xLabel: `${tt('bar.span')} (${lenTxt})`,
          yLabel: `${tt('bar.chart.yWork')} (${massTxt})`,
          vLine: currentX,
          hLine: currentLoad,
          lang,
        });
      chartHost.innerHTML = `<div class="chart-title">${tt('bar.chart.title')} - ${esc(mat.name)}</div>` +
        lineChart({
          points: ultPoints,
          xMin: lenFromSI(spanMin, u.len),
          xMax: lenFromSI(spanMax, u.len),
          yMax: capYMax(ultPoints),
          xLabel: `${tt('bar.span')} (${lenTxt})`,
          yLabel: `${tt('bar.chart.y')} (${massTxt})`,
          vLine: currentX,
          hLine: currentLoad,
          lang,
        });
    }

    compute();
    container.append(
      el('h2', {}, tt('bar.heading')),
      el('p', { class: 'intro' }, tt('bar.intro')),
      el('div', { class: 'twocol analysis-layout' },
        inputs,
        el('div', { class: 'analysis-output analysis-output-bar' },
          el('div', { class: 'analysis-top' }, results, deflHost),
          legend,
          el('div', { class: 'chart-grid' }, workHost, chartHost))));
  },
};
