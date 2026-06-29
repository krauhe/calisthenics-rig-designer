// Fane: Materialer. Udleder en indkøbs-/materialeliste og en skæreliste (6 m
// rør pakket med FFD) ud fra tegningen på Kort — generaliseret fra den
// oprindelige enkelt-fil-app til en vilkårlig stolpe+forbindelses-graf.

function computeMaterials(design) {
  const connMat = ref => { const id = ref && ref.source === 'library' ? ref.id : ref; return design.library.find(m => m.id === id) || design.library[0]; };
  const byId = Object.fromEntries(design.posts.map(p => [p.id, p]));
  const spanOf = c => { const a = byId[c.a], b = byId[c.b]; return (a && b) ? Math.hypot(b.x_m - a.x_m, b.z_m - a.z_m) : 0; };

  const depth = (design.defaults.post && design.defaults.post.depth_m) || 1.2;
  const hole = ((design.defaults.post && design.defaults.post.hole_mm) || 300) / 1000;
  const maxConnH = design.connections.reduce((m, c) => Math.max(m, c.height_m), 0) || (design.site.connHeight_m || 2.2);
  const postAbove = Math.max(maxConnH + 0.15, 2.0);
  const postLen = postAbove + depth;
  const postMat = resolveMaterial(design, design.defaults.post.materialId);
  const postSide = (postMat.side || postMat.od || 125) / 1000;
  const postCount = design.posts.length;

  // bar-grupper (perimeter) til tabellen, pr. materiale
  const barGroups = {};   // id -> { mat, totalLen, count }
  design.connections.forEach(c => {
    const span = spanOf(c); if (span <= 0) return;
    const mat = connMat(c.material);
    const g = barGroups[mat.id] = barGroups[mat.id] || { mat, totalLen: 0, count: 0 };
    g.totalLen += span; g.count++;
  });

  // skære-stykker (KUN rør) pr. materiale: perimeter-rør + stige-rør + trin
  const cut = {};         // id -> { mat, pieces:[{len,label}] }
  const addCut = (mat, len, label) => { if (!mat || mat.kind !== 'pipe' || len <= 0) return; (cut[mat.id] = cut[mat.id] || { mat, pieces: [] }).pieces.push({ len, label }); };
  design.connections.forEach((c, i) => addCut(connMat(c.material), spanOf(c), letterFor(i)));

  // stiger (binder sig til den højeste bar på stolpen — som i 3D/Kort)
  const ladderBar = at => {
    const conns = design.connections.filter(c => c.a === at.postId || c.b === at.postId);
    if (!conns.length) return null;
    let best = conns[0]; for (const c of conns) if (c.height_m > best.height_m) best = c;
    return best;
  };
  const ladderMat = design.library.find(m => m.id === 'pipe-1') || design.library.find(m => m.kind === 'pipe') || null;
  let ladVert = 0, ladRungLen = 0, ladRungCount = 0, ladKee = 0, ladderCount = 0;
  design.attachments.forEach(at => {
    if (at.type !== 'ladder') return;
    ladderCount++;
    const bar = ladderBar(at);
    const barY = bar ? bar.height_m : (design.site.connHeight_m || 2.2);
    const width = at.width_m || 0.5;
    const vert = barY + 0.5;
    const rc = Math.max(0, Math.floor((barY - 0.25) / 0.40));
    ladVert += vert; ladRungCount += rc; ladRungLen += rc * width; ladKee += 1 + rc * 2;
    addCut(ladderMat, vert, 'stige');
    for (let k = 0; k < rc; k++) addCut(ladderMat, width, 't' + (k + 1));
  });

  // fundament
  const concVolEach = (hole * hole - postSide * postSide) * Math.max(0, depth - GRAVEL_H);
  const footVol = 0.22 * 0.22 * 0.5;
  const concVol = concVolEach * postCount + footVol * ladderCount;
  const gravelVol = hole * hole * GRAVEL_H * postCount + 0.22 * 0.22 * GRAVEL_H * ladderCount;
  const bags25 = Math.ceil(concVol / 0.0125);
  const tarZoneH = TAR_TOP - Math.max(TAR_BOTTOM, -depth);
  const tarArea = (4 * postSide * tarZoneH + postSide * postSide) * postCount;
  const tarLitre = tarArea * 0.35;
  const pipeConnCount = design.connections.filter(c => connMat(c.material).kind === 'pipe').length;

  return {
    postMat, postCount, postLen, postAbove, depth, postSide, hole,
    barGroups, cut, pipeConnCount,
    ladderCount, ladVert, ladRungLen, ladRungCount, ladKee,
    concVol, concVolEach, gravelVol, bags25, tarLitre,
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
    if (!design.posts.length) { container.append(el('div', { class: 'soon' }, el('p', {}, tt('mats.empty')))); return; }

    const M = computeMaterials(design);

    // ---- materialeliste (tabel) ----
    const rows = [];
    rows.push([`${M.postMat.name} (${tt('mats.posts')})`, `${M.postCount} ${tt('mats.pcs')} · ${fm(M.postLen)}`]);
    rows.push([`  (${fm(M.postAbove)} ${tt('mats.above')} + ${fm(M.depth)} ${tt('mats.buried')})`, '']);
    for (const id of Object.keys(M.barGroups)) {
      const g = M.barGroups[id];
      const kind = g.mat.kind === 'wood' ? tt('mat.kind.wood') : tt('mat.kind.pipe');
      rows.push([`${g.mat.name} — ${kind}`, `${g.count} ${tt('mats.pcs')} · ${fm(g.totalLen)} ${tt('mats.total')}`]);
    }
    if (M.pipeConnCount > 0) rows.push([tt('mats.fittings'), `${M.pipeConnCount * 2} ${tt('mats.pcs')}`]);
    if (M.ladderCount > 0) {
      rows.push([tt('mats.ladderVert'), fm(M.ladVert)]);
      rows.push([`${tt('mats.ladderRungs')} (${M.ladRungCount} ${tt('mats.pcs')})`, fm(M.ladRungLen)]);
      rows.push([tt('mats.ladderKee'), `${M.ladKee} ${tt('mats.pcs')}`]);
    }
    rows.push([tt('mats.screws'), `~${32 + M.ladRungCount * 4} ${tt('mats.pcs')}`]);
    rows.push([tt('mats.gravel'), `${Math.round(M.gravelVol * 1000)} L`]);
    rows.push([tt('mats.concrete'), `${fmt(M.concVol, 2, lang)} m³`]);
    rows.push([`  ${tt('mats.bags')}`, `~${M.bags25}`]);
    rows.push([tt('mats.tar'), `~${fmt(M.tarLitre, 1, lang)} L`]);

    const tbl = el('table', { class: 'mat-list' },
      el('tbody', {}, ...rows.map(r => el('tr', {}, el('td', {}, r[0]), el('td', { class: 'q' }, r[1])))));
    container.append(el('h3', {}, tt('mats.tableTitle')), tbl);
    container.append(el('p', { class: 'mat-note' },
      `${tt('mats.assume1')} ${Math.round(M.hole * 100)}×${Math.round(M.hole * 100)} cm, ${Math.round(GRAVEL_H * 100)} cm ${tt('mats.gravelShort')}. ${tt('mats.assume2')}`));

    // ---- skæreliste (rør pakket i hele stænger; købslængde pr. materiale) ----
    container.append(el('h3', { class: 'cut-h' }, tt('mats.cutTitle')));
    const cutHost = el('div', { class: 'cutlist' });
    let totalBars = 0;
    const ids = Object.keys(M.cut).sort();
    for (const id of ids) {
      const grp = M.cut[id];
      const stockLen = (design.stock && design.stock[id]) || STOCK;
      const { bars, count } = packPieces(grp.pieces, stockLen, KERF);
      totalBars += count;
      const oversize = grp.pieces.some(p => p.len > stockLen + 1e-9);

      // pr. materiale: redigerbar købslængde (gemmes i design.stock[matId])
      const stockInp = el('input', { type: 'number', step: '0.5', min: '0.5', value: String(round(stockLen)), class: 'cl-stock-inp' });
      stockInp.addEventListener('change', () => {
        const v = parseFloat(stockInp.value);
        if (v > 0) { store.update(d => { d.stock = d.stock || {}; d.stock[id] = v; }); ctx.rerender(); }
      });
      const grpEl = el('div', { class: 'cl-grp' },
        el('div', { class: 'cl-grp-h' },
          el('b', {}, `${grp.mat.name}: ${count} × ${fmt(stockLen, stockLen % 1 ? 2 : 0, lang)} m`),
          el('label', { class: 'cl-stock' }, `${tt('mats.stockLen')} (m)`, stockInp)));

      bars.forEach(b => {
        const barEl = el('div', { class: 'cl-bar' });
        b.pieces.forEach((p, pi) => {
          barEl.append(el('span', { class: 'cl-seg', title: `${p.label}: ${fm(p.len)}`,
            style: `width:${Math.min(100, p.len / stockLen * 100).toFixed(2)}%;background:${COLORS[pi % COLORS.length]}` }, fmt(p.len, 2, lang)));
        });
        if (b.waste > 0.01) barEl.append(el('span', { class: 'cl-waste', title: `${tt('mats.waste')} ${fm(b.waste)}`,
          style: `width:${(b.waste / stockLen * 100).toFixed(2)}%` }, fmt(b.waste, 2, lang)));
        grpEl.append(barEl);
        const list = b.pieces.map(p => `${p.label} ${fmt(p.len, 2, lang)}`).join('  ·  ');
        grpEl.append(el('div', { class: 'cl-list' }, `${list}${b.waste > 0.01 ? `  ·  ${tt('mats.waste')} ${fm(b.waste)}` : ''}`));
      });
      if (oversize) grpEl.append(el('div', { class: 'cl-warn' }, tt('mats.tooLong')));
      cutHost.append(grpEl);
    }
    if (!totalBars) cutHost.append(el('div', { class: 'sel-hint' }, tt('mats.noPipes')));
    container.append(cutHost);
    container.append(el('p', { class: 'mat-note' },
      `${tt('mats.cutTotal1')} ${totalBars} ${tt('mats.cutTotal2')} ${KERF * 1000} mm ${tt('mats.cutTotal3')}`));
  },
};
