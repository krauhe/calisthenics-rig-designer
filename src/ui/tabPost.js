// Fane: Stolpe-analyse. Bruger foundation() fra kernen.

import { el, clear } from './dom.js';
import { field, lenInput, dimInput, unitToggle } from './controls.js';
import { materialControl } from './library.js';
import { resolveMaterial } from '../core/model.js';
import { sectionProps } from '../core/sections.js';
import { foundation } from '../core/foundation.js';
import { fmt } from '../core/units.js';

export const tabPost = {
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
      field(`${tt('post.hole')} (${dimTxt})`, dimInput(a.hole_mm, u.dim, v => set(d => { d.analysis.post.hole_mm = v; }))),
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
        resRow(tt('post.res.sway'), `${fmt(swayMm, swayMm < 10 ? 1 : 0, lang)} mm (${tt('post.res.sway1')})`, 'big'),
        resRow('', `${fmt(swayMm / 2, swayMm < 20 ? 1 : 0, lang)} mm (${tt('post.res.sway2')})`),
        resRow(tt('post.res.rot'), `${Math.round(f.Ktheta / 1000)} kNm/rad`),
        resRow(tt('post.res.feel'), tt(feelKey)));
    }

    compute();
    container.append(
      el('h2', {}, tt('post.heading')),
      el('p', { class: 'intro' }, tt('post.intro')),
      el('div', { class: 'twocol' }, inputs, results));
  },
};
