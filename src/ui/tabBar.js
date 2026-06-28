// Fane: Bar-analyse. Bruger beam() fra kernen + en kapacitets-graf.

import { el, clear } from './dom.js';
import { field, lenInput, numInput, unitToggle } from './controls.js';
import { materialControl } from './library.js';
import { resolveMaterial } from '../core/model.js';
import { beam } from '../core/mechanics.js';
import { fmt, fmtDeflection } from '../core/units.js';
import { capacityChart, COLORS, lineChart } from './chart.js';

export const tabBar = {
  id: 'bar',
  labelKey: 'tab.bar',
  render(container, ctx) {
    const { design, store, lang, rerender } = ctx;
    const a = design.analysis.bar;
    const u = design.units.bar;
    const tt = k => ctx.t(k, lang);
    const lenTxt = tt(u.len === 'ft' ? 'unit.ft' : 'unit.m');

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
          v => { store.update(d => { d.units.bar.dim = v; }); rerender(); })),
      el('div', { class: 'mat-block' },
        el('span', { class: 'fld-l' }, tt('mat.title')),
        materialControl(ctx, 'bar')),
      field(`${tt('bar.span')} (${lenTxt})`, lenInput(a.span_m, u.len, v => set(d => { d.analysis.bar.span_m = v; }))),
      field(`${tt('bar.load')} (kg)`, numInput(a.load_kg, 5, v => set(d => { d.analysis.bar.load_kg = v; }))),
      field(`${tt('bar.fixity')}`, numInput(a.fixity, 0.05, v => set(d => { d.analysis.bar.fixity = Math.min(1, Math.max(0, v)); })), tt('bar.fixity.hint')));

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
        resRow(`${tt('bar.res.deflection')} (${Math.round(a.load_kg)} kg)`, fmtDeflection(b.dReal, lang), 'big'),
        resRow(tt('post.res.feel'), tt(feelKey)),
        resRow(tt('bar.res.yield'), `${Math.round(b.pYield)} kg`),
        resRow(tt('bar.res.ultimate'), `${Math.round(b.pUlt)} kg`));

      chartHost.innerHTML = `<div class="chart-title">${tt('bar.chart.title')}</div>` +
        capacityChart({ library: design.library, fixity: a.fixity, currentSpan: a.span_m, load: a.load_kg, t: ctx.t, lang });
      clear(legend);
      design.library.forEach((m, i) => legend.append(
        el('span', { class: 'leg-item' },
          el('span', { class: 'leg-sw', style: `background:${COLORS[i % COLORS.length]}` }),
          m.name)));

      // graf: nedbøjning som funktion af belastning (for det valgte materiale + spændvidde)
      const loads = [];
      for (let Lk = 0; Lk <= 200 + 1e-9; Lk += 10) loads.push(Lk);
      const dpts = loads.map(Lk => ({ x: Lk, y: beam(a.span_m, mat, Lk, a.fixity).dReal * 1000 }));
      const dyMax = Math.max(...dpts.map(p => p.y), 1) * 1.1;
      deflHost.innerHTML = `<div class="chart-title">${tt('bar.chart2.title')}</div>` +
        lineChart({ points: dpts, xMin: 0, xMax: 200, yMax: dyMax, xLabel: tt('bar.chart2.x'), yLabel: tt('bar.chart2.y'),
          vLine: a.load_kg, hLine: deflMm, lang });
    }

    compute();
    container.append(
      el('h2', {}, tt('bar.heading')),
      el('p', { class: 'intro' }, tt('bar.intro')),
      el('div', { class: 'twocol' },
        inputs,
        el('div', {}, results, deflHost, chartHost, legend)));
  },
};
