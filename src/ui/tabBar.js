// Fane: Bar-analyse. Bruger beam() fra kernen + to grafer.


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
    const cvDim = v => inch ? v / 25.4 : v;          // mm → visningsenhed

    const set = mut => { store.update(mut); compute(); };
    const results = el('div', { class: 'results' });
    const deflHost = el('div', { class: 'charthost' });
    const chartHost = el('div', { class: 'charthost' });
    const legend = el('div', { class: 'legend' });

    const inputs = el('div', { class: 'panel' },
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
      field(`${tt('bar.span')} (${lenTxt})`, lenInput(a.span_m, u.len, v => set(d => { d.analysis.bar.span_m = v; }))),
      field(`${tt('bar.load')} (${massTxt})`,
        numInput(Math.round(massFromSI(a.load_kg, massU)), massU === 'lb' ? 10 : 5,
          v => set(d => { d.analysis.bar.load_kg = massToSI(v, massU); }))),
      field(`${tt('bar.fixity')}`, numInput(a.fixity, 0.05,
        v => set(d => { d.analysis.bar.fixity = Math.min(1, Math.max(0, v)); })), tt('bar.fixity.hint')));

    function resRow(label, value, cls) {
      return el('div', { class: 'res' + (cls ? ' ' + cls : '') },
        el('span', { class: 'res-l' }, label), el('span', { class: 'res-v' }, value));
    }

    function compute() {
      const mat = resolveMaterial(design, a.materialId);
      const b = beam(a.span_m, mat, a.load_kg, a.fixity);
      const deflMm = b.dReal * 1000;
      const feelKey = deflMm < 7 ? 'feel.solid' : deflMm < 12 ? 'feel.springy' : 'feel.soft';
      clear(results);
      results.append(
        el('h3', {}, tt('post.res.title')),
        resRow(`${tt('bar.res.deflection')} (${fmtMass(a.load_kg, massU, lang)})`, fmtDispl(deflMm, u.dim, lang), 'big'),
        resRow(tt('post.res.feel'), tt(feelKey)),
        resRow(tt('bar.res.yield'), fmtMass(b.pYield, massU, lang)),
        resRow(tt('bar.res.ultimate'), fmtMass(b.pUlt, massU, lang)));

      // graf 1: nedbøjning vs. belastning — alle materialer, samme farvekode
      const loads = [];
      for (let Lk = 0; Lk <= 200 + 1e-9; Lk += 10) loads.push(Lk);
      let maxMm = 0;
      design.library.forEach(m => { maxMm = Math.max(maxMm, beam(a.span_m, m, 200, a.fixity).dReal * 1000); });
      const dyMax = cvDim(Math.min(maxMm * 1.1, 80) || 1);
      const series = design.library.map((m, i) => ({
        color: COLORS[i % COLORS.length],
        points: loads.map(Lk => ({ x: massFromSI(Lk, massU), y: cvDim(beam(a.span_m, m, Lk, a.fixity).dReal * 1000) })),
      }));
      deflHost.innerHTML = `<div class="chart-title">${tt('bar.chart2.title')} · ${fmt(lenFromSI(a.span_m, u.len), 2, lang)} ${lenTxt}</div>` +
        lineChart({ series, xMin: 0, xMax: massFromSI(200, massU), yMax: dyMax,
          xLabel: `${tt('bar.chart2.x')} (${massTxt})`, yLabel: `${tt('bar.chart2.y')} (${inch ? 'in' : 'mm'})`,
          vLine: massFromSI(a.load_kg, massU), lang });

      // delt farve-legende (mellem graferne)
      clear(legend);
      design.library.forEach((m, i) => legend.append(
        el('span', { class: 'leg-item' },
          el('span', { class: 'leg-sw', style: `background:${COLORS[i % COLORS.length]}` }),
          m.name)));

      // graf 2: bæreevne vs. spændvidde — alle materialer
      chartHost.innerHTML = `<div class="chart-title">${tt('bar.chart.title')}</div>` +
        capacityChart({ library: design.library, fixity: a.fixity, currentSpan: a.span_m, load: a.load_kg, massU, t: ctx.t, lang });
    }

    compute();
    container.append(
      el('h2', {}, tt('bar.heading')),
      el('p', { class: 'intro' }, tt('bar.intro')),
      el('div', { class: 'twocol' },
        inputs,
        el('div', {}, results, deflHost, legend, chartHost)));
  },
};
