// Fane: Materialer. Udleder en indkøbs-/materialeliste og en skæreliste (6 m
// rør pakket med FFD) ud fra tegningen på Kort — generaliseret fra den
// oprindelige enkelt-fil-app til en vilkårlig stolpe+forbindelses-graf.

function computeMaterials(design) {
  const connMat = ref => connMatOf(design, ref);
  const byId = Object.fromEntries(design.posts.map(p => [p.id, p]));
  const spanOf = c => spanOfConn(design, c);

  const depth = (design.defaults.post && design.defaults.post.depth_m) || 1.2;
  const hole = ((design.defaults.post && design.defaults.post.hole_mm) || 200) / 1000;
  const siteDefH = design.site.postHeight_m || 3.0;
  // pr. stolpe-mål (som på Kort) — falder tilbage til standarderne
  const postHeightOf = p => postHeightOfD(design, p);
  const postDepthOf = p => postDepthOfD(design, p);
  const postHoleM = p => postHoleMmOf(design, p) / 1000;
  const postMat = resolveMaterial(design, design.defaults.post.materialId);
  const postSide = (postMat.side || postMat.od || 125) / 1000;
  const postCount = design.posts.length;
  const postLetter = id => postLetterOf(design, id);
  const connLbl = c => connLabelOf(design, c);

  // bar-grupper (perimeter) til tabellen, pr. materiale
  const barGroups = {};   // id -> { mat, totalLen, count }
  design.connections.forEach(c => {
    const span = spanOf(c); if (span <= 0) return;
    const mat = connMat(c.material);
    const g = barGroups[mat.id] = barGroups[mat.id] || { mat, totalLen: 0, count: 0 };
    g.totalLen += span; g.count++;
  });

  // skære-stykker pr. materiale: stolper + barer/overliggere (rør OG træ) + stige-rør
  const cut = {};         // id -> { mat, pieces:[{len,label}] }
  const addCut = (mat, len, label) => { if (!mat || len <= 0) return; (cut[mat.id] = cut[mat.id] || { mat, pieces: [] }).pieces.push({ len, label }); };
  // stolper (lodrette) — hver: egen højde over jord + egen nedgravning (fra Kort)
  let postTotalLen = 0, buriedTotal = 0;
  design.posts.forEach((p, i) => { const lenP = postHeightOf(p) + postDepthOf(p); postTotalLen += lenP; buriedTotal += postDepthOf(p); addCut(postMat, lenP, letterFor(i)); });
  // barer / overliggere
  design.connections.forEach(c => addCut(connMat(c.material), spanOf(c), connLbl(c)));

  // stiger (binder sig til den højeste bar på stolpen — som i 3D/Kort)
  const ladderBar = at => {
    const conns = design.connections.filter(c => c.a === at.postId || c.b === at.postId);
    if (!conns.length) return null;
    let best = conns[0]; for (const c of conns) if (c.height_m > best.height_m) best = c;
    return best;
  };
  // ladderMat kan være null (intet rør-bibliotek) — addCut no-opper stille når mat er null,
  // så stige-/armgangs-tællere (ladVert, ladRungCount osv.) opgøres stadig, men uden skæreliste-stykker.
  const ladderMat = design.library.find(m => m.id === 'pipe-1') || design.library.find(m => m.kind === 'pipe') || null;
  let ladVert = 0, ladRungLen = 0, ladRungCount = 0, ladKee = 0, ladderCount = 0;
  design.attachments.forEach(at => {
    if (at.type !== 'ladder') return;
    ladderCount++;
    const bar = ladderBar(at);
    const barY = Math.max(0, bar ? bar.height_m : (design.site.connHeight_m || 2.2));
    const width = Math.max(0.05, at.width_m || 0.5);
    const vert = barY + 0.5;
    const rc = Math.max(0, Math.floor((barY - 0.25) / 0.40));
    ladVert += vert; ladRungCount += rc; ladRungLen += rc * width; ladKee += 1 + rc * 2;
    addCut(ladderMat, vert, 'stige');
    for (let k = 0; k < rc; k++) addCut(ladderMat, width, 't' + (k + 1));
  });

  // armgange (monkey bars): 1"-trin mellem to barer + 2 klemmer pr. trin
  let monRungCount = 0, monRungLen = 0, monKee = 0, monkeyCount = 0;
  design.attachments.forEach(at => {
    if (at.type !== 'monkey') return;
    const g = monkeyGeometry(design, at.connA, at.connB, at.spacing_m);
    if (!g || !g.rungs.length) return;
    monkeyCount++;
    monRungCount += g.count; monRungLen += g.count * g.rungLen; monKee += g.count * 2;
    for (let k = 0; k < g.count; k++) addCut(ladderMat, g.rungLen, 'g' + (k + 1));
  });

  // fundament — pr. stolpe (egen dybde + hul fra Kort)
  const footVol = 0.22 * 0.22 * 0.5;
  let concVol = 0, gravelVol = 0, tarArea = 0;
  design.posts.forEach(p => {
    const dP = postDepthOf(p), hP = postHoleM(p);
    concVol += (hP * hP - postSide * postSide) * Math.max(0, dP - GRAVEL_H);
    gravelVol += hP * hP * GRAVEL_H;
    tarArea += 4 * postSide * (TAR_TOP - Math.max(TAR_BOTTOM, -dP)) + postSide * postSide;
  });
  concVol += footVol * ladderCount;
  gravelVol += 0.22 * 0.22 * GRAVEL_H * ladderCount;
  const bags25 = Math.ceil(concVol / 0.0125);
  const tarLitre = tarArea * 0.35;
  const pipeConnCount = design.connections.filter(c => connMat(c.material).kind === 'pipe').length;

  return {
    postMat, postCount, postTotalLen, buriedTotal, depth, postSide, hole,
    barGroups, cut, pipeConnCount,
    ladderCount, ladVert, ladRungLen, ladRungCount, ladKee,
    monkeyCount, monRungCount, monRungLen, monKee,
    concVol, gravelVol, bags25, tarLitre,
  };
}

const tabMaterials = {
  id: 'materials',
  labelKey: 'tab.materials',
  render(container, ctx) {
    const { design, store } = ctx;
    const lang = ctx.lang;
    const tt = k => ctx.t(k, lang);
    const fm = v => fmt(v, 2, lang) + ' m';

    container.append(el('h2', {}, tt('tab.materials')), el('p', { class: 'intro' }, tt('mats.intro')));
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
    rows.push({ l: `${M.postMat.name} (${tt('mats.posts')})`, q: `${M.postCount} ${tt('mats.pcs')} · ${fm(M.postTotalLen)} ${tt('mats.total')}`, c: materialColor(M.postMat) });
    rows.push({ l: `${tt('mats.incl')} ${fm(M.buriedTotal)} ${tt('mats.buried')}`, q: '', sub: true });
    for (const id of Object.keys(M.barGroups)) {
      const g = M.barGroups[id];
      const kind = g.mat.kind === 'wood' ? tt('mat.kind.wood') : tt('mat.kind.pipe');
      rows.push({ l: `${g.mat.name} — ${kind}`, q: `${g.count} ${tt('mats.pcs')} · ${fm(g.totalLen)} ${tt('mats.total')}`, c: materialColor(g.mat) });
    }
    if (M.pipeConnCount > 0) rows.push({ l: tt('mats.fittings'), q: `${M.pipeConnCount * 2} ${tt('mats.pcs')}` });
    if (M.ladderCount > 0) {
      rows.push({ l: tt('mats.ladderVert'), q: fm(M.ladVert) });
      rows.push({ l: `${tt('mats.ladderRungs')} (${M.ladRungCount} ${tt('mats.pcs')})`, q: fm(M.ladRungLen) });
      rows.push({ l: tt('mats.ladderKee'), q: `${M.ladKee} ${tt('mats.pcs')}` });
    }
    if (M.monkeyCount > 0) {
      rows.push({ l: `${tt('mats.monkeyRungs')} (${M.monRungCount} ${tt('mats.pcs')})`, q: fm(M.monRungLen) });
      rows.push({ l: tt('mats.monkeyKee'), q: `${M.monKee} ${tt('mats.pcs')}` });
    }
    rows.push({ l: tt('mats.screws'), q: `~${32 + (M.ladRungCount + M.monRungCount) * 4} ${tt('mats.pcs')}` });
    rows.push({ l: tt('mats.gravel'), q: `${Math.round(M.gravelVol * 1000)} L` });
    rows.push({ l: tt('mats.concrete'), q: `${fmt(M.concVol, 2, lang)} m³` });
    rows.push({ l: tt('mats.bags'), q: `~${M.bags25}`, sub: true });
    rows.push({ l: tt('mats.tar'), q: `~${fmt(M.tarLitre, 1, lang)} L` });

    const tbl = el('table', { class: 'mat-list' },
      el('tbody', {}, ...rows.map(r => el('tr', { class: r.sub ? 'sub' : null },
        el('td', {}, r.c ? el('span', { class: 'mat-dot', style: `background:${r.c}` }) : null, r.l),
        el('td', { class: 'q' }, r.q)))));
    container.append(el('h3', {}, tt('mats.tableTitle')), tbl);
    container.append(el('p', { class: 'mat-note' },
      `${tt('mats.assume1')} ${Math.round(M.hole * 100)}×${Math.round(M.hole * 100)} cm, ${Math.round(GRAVEL_H * 100)} cm ${tt('mats.gravelShort')}. ${tt('mats.assume2')}`));

    // ---- skæreliste (rør/træ pakket i hele stænger; købslængde pr. materiale) ----
    container.append(el('h3', { class: 'cut-h' }, tt('mats.cutTitle')));
    const cutHost = el('div', { class: 'cutlist' });
    const ids = Object.keys(M.cut).sort();
    const counts = {};
    const footNote = el('p', { class: 'mat-note' });
    const updateFoot = () => {
      const total = Object.values(counts).reduce((s, n) => s + n, 0);
      footNote.textContent = `${tt('mats.cutTotal1')} ${total} ${tt('mats.cutTotal2')} ${KERF * 1000} mm ${tt('mats.cutTotal3')}`;
    };

    for (const id of ids) {
      const grp = M.cut[id];
      const matCol = materialColor(grp.mat);
      const shades = segShades(grp.mat);

      // pr. materiale: redigerbar købslængde (gemmes i design.stock[matId]) — opdateres på stedet
      const stockInp = el('input', { type: 'number', step: '0.5', min: '0.5', class: 'cl-stock-inp' });
      const titleB = el('b', {}, el('span', { class: 'cl-dot', style: `background:${matCol}` }), el('span', { class: 'cl-name' }));
      const body = el('div', { class: 'cl-body' });
      const warnHost = el('div', {});
      const grpEl = el('div', { class: 'cl-grp', style: `border-left-color:${matCol}` },
        el('div', { class: 'cl-grp-h' }, titleB,
          el('label', { class: 'cl-stock' }, `${tt('mats.stockLen')} (m)`, stockInp)));
      grpEl.append(body, warnHost);

      const refresh = () => {
        const stockLen = (design.stock && design.stock[id]) || (grp.mat.kind === 'wood' ? 4.8 : STOCK);
        stockInp.value = String(round(stockLen));
        const { bars, count } = packPieces(grp.pieces, stockLen, KERF);
        counts[id] = count;
        const oversize = grp.pieces.some(p => p.len > stockLen + 1e-9);
        titleB.querySelector('.cl-name').textContent = ` ${grp.mat.name}: ${count} × ${fmt(stockLen, stockLen % 1 ? 2 : 0, lang)} m`;
        clear(body);
        bars.forEach(b => {
          const barEl = el('div', { class: 'cl-bar' });
          b.pieces.forEach((p, pi) => {
            barEl.append(el('span', { class: 'cl-seg', title: `${p.label}: ${fm(p.len)}`,
              style: `width:${Math.min(100, p.len / stockLen * 100).toFixed(2)}%;background:${shades[pi % shades.length]}` },
              el('span', { class: 'cl-seg-lbl' }, p.label), fmt(p.len, 2, lang)));
          });
          if (b.waste > 0.01) barEl.append(el('span', { class: 'cl-waste', title: `${tt('mats.waste')} ${fm(b.waste)}`,
            style: `width:${(b.waste / stockLen * 100).toFixed(2)}%` }, fmt(b.waste, 2, lang)));
          body.append(barEl);
          const list = b.pieces.map(p => `${p.label} ${fmt(p.len, 2, lang)}`).join('  ·  ');
          body.append(el('div', { class: 'cl-list' }, `${list}${b.waste > 0.01 ? `  ·  ${tt('mats.waste')} ${fm(b.waste)}` : ''}`));
        });
        clear(warnHost);
        if (oversize) warnHost.append(el('div', { class: 'cl-warn' }, tt('mats.tooLong')));
        updateFoot();
      };
      stockInp.addEventListener('input', () => {
        const v = parseFloat(stockInp.value);
        if (!isNaN(v)) { store.update(d => { d.stock = d.stock || {}; d.stock[id] = Math.max(v, 0.5); }); refresh(); }
      });
      stockInp.addEventListener('change', () => { stockInp.value = String(Math.max(parseFloat(stockInp.value) || 0, 0.5)); });
      refresh();
      cutHost.append(grpEl);
    }
    if (!Object.keys(M.cut).length) cutHost.append(el('div', { class: 'sel-hint' }, tt('mats.noPipes')));
    container.append(cutHost);
    container.append(footNote);
  },
};
