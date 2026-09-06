// Fane: Materialer. Viser indkøbs-/materialelisten og skærelisten fra
// computeMaterials() i kernen (src/core/materials.js) — ren visning her.

const tabMaterials = {
  id: 'materials',
  labelKey: 'tab.materials',
  render(container, ctx) {
    const { design, store } = ctx;
    const lang = ctx.lang;
    const tt = k => ctx.t(k, lang);
    // længder vises i kortets valgte enhed (m eller fod), som på Kort-fanen
    const su = (design.units.site && design.units.site.len) || 'm';
    const suTxt = su === 'ft' ? tt('unit.ft') : tt('unit.m');
    const fm = v => `${fmt(lenFromSI(v, su), 2, lang)} ${suTxt}`;

    container.append(el('h2', {}, tt('tab.materials')), el('p', { class: 'intro' }, tt('mats.intro')));

    const pipeTable = el('table', { class: 'pipe-spec-table' },
      el('thead', {}, el('tr', {},
        ...['mats.pipeName', 'mat.wall', 'mats.pipeStandard'].map(k => el('th', {}, tt(k))))));
    const pipeRows = el('tbody');
    for (const mat of design.library.filter(m => m.kind === 'pipe')) {
      const standard = findMaterial(mat.id);
      const inp = numInput(mat.wall, 0.1, value => {
        store.update(d => {
          const m = resolveMaterial(d, mat.id);
          m.wall = clampPipeWallMm(m, value, m.wall);
          m.wallCustom = true;
        });
        renderResults();
      }, { min: MIN_PIPE_WALL_MM, max: maxPipeWallMm(mat), commitOnChange: true });
      inp.className = 'pipe-wall-input';
      inp.setAttribute('aria-label', `${mat.name}: ${tt('mat.wall')} (mm)`);
      const reset = standard ? el('button', { type: 'button', class: 'pipe-wall-reset',
        title: tt('mats.pipeReset'), 'aria-label': `${mat.name}: ${tt('mats.pipeReset')}`,
        onclick: () => {
          store.update(d => { const m = resolveMaterial(d, mat.id); m.wall = standard.wall; delete m.wallCustom; });
          inp.value = String(standard.wall);
          renderResults();
        } }, '↺') : null;
      pipeRows.append(el('tr', {},
        el('td', {}, mat.name, el('small', {}, ` Ø ${fmt(mat.od, 1, lang)} mm`)),
        el('td', { class: 'pipe-wall-cell' }, inp, ' mm'),
        el('td', { class: 'pipe-standard-cell' }, standard ? `${fmt(standard.wall, 1, lang)} mm` : tt('mats.pipeCustom'), reset)));
    }
    pipeTable.append(pipeRows);
    container.append(el('section', { class: 'pipe-specs' }, el('h3', {}, tt('mats.pipeTitle')), pipeTable));
    const resultsHost = el('div');
    container.append(resultsHost);
    const renderResults = () => {
    const container = clear(resultsHost);
    if (!design.posts.length) {
      container.append(el('div', { class: 'empty-state empty-mats' },
        el('div', { class: 'material-ghost', 'aria-hidden': 'true' },
          el('span', { class: 'mat-stack mat-stack-a' }),
          el('span', { class: 'mat-stack mat-stack-b' }),
          el('span', { class: 'mat-stack mat-stack-c' }),
          el('span', { class: 'mat-bag' }),
          el('span', { class: 'mat-crate' })),
        el('p', {}, tt('mats.empty')),
        el('button', { class: 'btn-sm primary', type: 'button', onclick: () => ctx.openTab && ctx.openTab('site') }, tt('tab.site'))));
      return;
    }

    const M = computeMaterials(design);

    // ---- materialeliste (tabel) ----
    const rows = [];
    for (const id of Object.keys(M.postGroups)) {
      const g = M.postGroups[id];
      rows.push({ l: `${matLabel(g.mat, 'mm', lang)} (${tt('mats.posts')})`, q: `${g.count} ${tt('mats.pcs')} · ${fm(g.totalLen)} ${tt('mats.total')}`, c: materialColor(g.mat) });
      rows.push({ l: `${tt('mats.incl')} ${fm(g.buried)} ${tt('mats.buried')}`, q: '', sub: true });
    }
    for (const id of Object.keys(M.barGroups)) {
      const g = M.barGroups[id];
      const kind = g.mat.kind === 'wood' ? tt('mat.kind.wood') : tt('mat.kind.pipe');
      rows.push({ l: `${matLabel(g.mat, 'mm', lang)} — ${kind}`, q: `${g.count} ${tt('mats.pcs')} · ${fm(g.totalLen)} ${tt('mats.total')}`, c: materialColor(g.mat) });
    }
    if (M.pipeConnCount > 0) rows.push({ l: tt('mats.fittings'), q: `${M.pipeConnCount * 2} ${tt('mats.pcs')}` });
    if (M.ladderCount > 0) {
      rows.push({ l: tt('mats.ladderVert'), q: fm(M.ladVert) });
      rows.push({ l: `${tt('mats.ladderRungs')} (${M.ladRungCount} ${tt('mats.pcs')})`, q: fm(M.ladRungLen) });
      rows.push({ l: tt('mats.ladderPostFittings'), q: `${M.ladPostFittings} ${tt('mats.pcs')}` });
      rows.push({ l: tt('mats.ladderTees'), q: `${M.ladTees} ${tt('mats.pcs')}` });
    }
    if (M.monkeyCount > 0) {
      rows.push({ l: `${tt('mats.monkeyRungs')} (${M.monRungCount} ${tt('mats.pcs')})`, q: fm(M.monRungLen) });
      if (M.monKee > 0) rows.push({ l: tt('mats.monkeyKee'), q: `${M.monKee} ${tt('mats.pcs')}` });
      if (M.monSwivel > 0) rows.push({ l: tt('mats.monkeySwivel'), q: `${M.monSwivel} ${tt('mats.pcs')}` });
    }
    rows.push({ l: tt('mats.screws'), q: `~${32 + (M.ladRungCount + M.monRungCount) * 4} ${tt('mats.pcs')}` });
    rows.push({ l: tt('mats.gravel'), q: `${Math.round(M.gravelVol * 1000)} L` });
    rows.push({ l: tt('mats.filterFabric'), q: `${M.filterFabricCount} ${tt('mats.pcs')} · ~${fmt(M.filterFabricArea, 2, lang)} m²` });
    rows.push({ l: tt('mats.concrete'), q: `${fmt(M.concVol, 2, lang)} m³` });
    rows.push({ l: tt('mats.bags'), q: `~${M.bags25}`, sub: true });
    rows.push({ l: tt('mats.tar'), q: `~${fmt(M.tarLitre, 1, lang)} L` });

    const tbl = el('table', { class: 'mat-list' },
      el('tbody', {}, ...rows.map(r => el('tr', { class: r.sub ? 'sub' : null },
        el('td', {}, r.c ? el('span', { class: 'mat-dot', style: `background:${r.c}` }) : null, r.l),
        el('td', { class: 'q' }, r.q)))));
    container.append(el('h3', {}, tt('mats.tableTitle')), tbl);
    container.append(el('p', { class: 'mat-note' },
      `${tt('mats.assume1')} ${Math.round(M.hole * 100)} cm, ${Math.round(GRAVEL_H * 100)} cm ${tt('mats.gravelShort')}. ${tt('mats.assume2')}`));

    // ---- skæreliste (rør/træ pakket i hele stænger; købslængde pr. materiale) ----
    let kerfMm = Math.max(0.1, design.site.cutKerf_mm ?? KERF * 1000);
    let kerfM = kerfMm / 1000;
    const refreshers = [];
    const kerfInp = numInput(kerfMm, 0.1, v => {
      store.update(d => { d.site.cutKerf_mm = Math.max(v, 0.1); });
      kerfMm = design.site.cutKerf_mm; kerfM = kerfMm / 1000;
      refreshers.forEach(refresh => refresh());
    }, { min: 0.1 });
    container.append(el('h3', { class: 'cut-h' }, tt('mats.cutTitle')),
      el('div', { class: 'cut-settings', title: tt('mats.kerfHint') },
        el('label', { class: 'fld inline' }, el('span', { class: 'fld-l' }, `${tt('mats.kerf')} (mm)`), kerfInp),
        el('span', { class: 'cut-settings-hint' }, tt('mats.kerfHint'))));
    const cutHost = el('div', { class: 'cutlist' });
    const ids = Object.keys(M.cut).sort();
    const counts = {};
    const footNote = el('p', { class: 'mat-note' });
    const updateFoot = () => {
      const total = Object.values(counts).reduce((s, n) => s + n, 0);
      footNote.textContent = `${tt('mats.cutTotal1')} ${total} ${tt('mats.cutTotal2')} ${tt('mats.kerf')}: ${fmt(kerfMm, 1, lang)} mm ${tt('mats.cutTotal3')}`;
    };

    for (const id of ids) {
      const grp = M.cut[id];
      const matCol = materialColor(grp.mat);
      const shades = segShades(grp.mat);

      // pr. materiale: redigerbar købslængde (gemmes i design.stock[matId] i meter,
      // vises/redigeres i kortets enhed) — opdateres på stedet
      const stockInp = el('input', { type: 'number', step: '0.5', min: String(round(lenFromSI(0.5, su))), class: 'cl-stock-inp' });
      const titleB = el('b', {}, el('span', { class: 'cl-dot', style: `background:${matCol}` }), el('span', { class: 'cl-name' }));
      const body = el('div', { class: 'cl-body' });
      const warnHost = el('div', {});
      const grpEl = el('div', { class: 'cl-grp', style: `border-left-color:${matCol}` },
        el('div', { class: 'cl-grp-h' }, titleB,
          el('label', { class: 'cl-stock' }, `${tt('mats.stockLen')} (${suTxt})`, stockInp)));
      grpEl.append(body, warnHost);

      const refresh = () => {
        const stockLen = (design.stock && design.stock[id]) || (grp.mat.kind === 'wood' ? 4.8 : STOCK);
        if (document.activeElement !== stockInp) stockInp.value = String(round(lenFromSI(stockLen, su)));
        const { bars, count } = packPieces(grp.pieces, stockLen, kerfM);
        counts[id] = count;
        const oversize = grp.pieces.some(p => p.len > stockLen + 1e-9);
        titleB.querySelector('.cl-name').textContent = ` ${matLabel(grp.mat, 'mm', lang)}: ${count} × ${fm(stockLen)}`;
        clear(body);
        bars.forEach(b => {
          const barEl = el('div', { class: 'cl-bar' });
          b.pieces.forEach((p, pi) => {
            barEl.append(el('span', { class: 'cl-seg', title: `${p.label}: ${fm(p.len)}`,
              style: `width:${Math.min(100, p.len / stockLen * 100).toFixed(2)}%;background:${shades[pi % shades.length]}` },
              el('span', { class: 'cl-seg-lbl' }, p.label), fmt(lenFromSI(p.len, su), 2, lang)));
            barEl.append(el('span', { class: 'cl-kerf', title: `${tt('mats.kerf')}: ${fmt(kerfMm, 1, lang)} mm`,
              style: `width:${(kerfM / stockLen * 100).toFixed(2)}%` }));
          });
          if (b.waste > 0.01) barEl.append(el('span', { class: 'cl-waste', title: `${tt('mats.waste')} ${fm(b.waste)}`,
            style: `width:${(b.waste / stockLen * 100).toFixed(2)}%` }, fmt(lenFromSI(b.waste, su), 2, lang)));
          body.append(barEl);
          const list = b.pieces.map(p => `${p.label} ${fmt(lenFromSI(p.len, su), 2, lang)}`).join('  ·  ');
          body.append(el('div', { class: 'cl-list' }, `${list}  ·  ${tt('mats.kerf')} ${fmt(kerfMm, 1, lang)} mm × ${b.pieces.length}${b.waste > 0.01 ? `  ·  ${tt('mats.waste')} ${fm(b.waste)}` : ''}`));
        });
        clear(warnHost);
        if (oversize) warnHost.append(el('div', { class: 'cl-warn' }, tt('mats.tooLong')));
        updateFoot();
      };
      stockInp.addEventListener('input', () => {
        const v = parseFloat(stockInp.value);
        if (!isNaN(v)) { store.update(d => { d.stock = d.stock || {}; d.stock[id] = Math.max(lenToSI(v, su), 0.5); }); refresh(); }
      });
      stockInp.addEventListener('change', () => { stockInp.value = String(Math.max(parseFloat(stockInp.value) || 0, round(lenFromSI(0.5, su)))); });
      refresh();
      refreshers.push(refresh);
      cutHost.append(grpEl);
    }
    if (!Object.keys(M.cut).length) cutHost.append(el('div', { class: 'sel-hint' }, tt('mats.noPipes')));
    container.append(cutHost);
    container.append(footNote);
    };
    renderResults();
  },
};
