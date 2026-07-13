// Print: samlet byggevejledning — tegning, stolpe-/forbindelsestabeller,
// materialeliste, skæreliste og støbe-trin i ét printvenligt dokument.
// Bygger et skjult #print-root og kalder window.print(); @media print-CSS'en
// gemmer appen og viser kun vejledningen.

// Lille selvstændig SVG-gengivelse af tegningen (sort/hvid-venlig, med mål).
function printMapSvg(design) {
  if (!design.posts.length) return '';
  const su = (design.units.site && design.units.site.len) || 'm';
  const xs = design.posts.map(p => p.x_m), zs = design.posts.map(p => p.z_m);
  const pad = 0.8;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minZ = Math.min(...zs) - pad, maxZ = Math.max(...zs) + pad;
  const Wp = 700, Hp = Math.max(240, Math.min(520, Wp * (maxZ - minZ) / (maxX - minX)));
  const k = Math.min(Wp / (maxX - minX), Hp / (maxZ - minZ));
  const sx = x => (x - minX) * k + (Wp - (maxX - minX) * k) / 2;
  const sy = z => (z - minZ) * k + (Hp - (maxZ - minZ) * k) / 2;
  const byId = Object.fromEntries(design.posts.map(p => [p.id, p]));
  const connMat = ref => connMatOf(design, ref);
  const postLetter = id => postLetterOf(design, id);
  let svg = '';
  design.connections.forEach(c => {
    const a = byId[c.a], b = byId[c.b]; if (!a || !b) return;
    const mat = connMat(c.material);
    const dimMm = mat.kind === 'wood' ? mat.side : mat.od;
    const span = Math.hypot(b.x_m - a.x_m, b.z_m - a.z_m);
    const x1 = sx(a.x_m), y1 = sy(a.z_m), x2 = sx(b.x_m), y2 = sy(b.z_m);
    svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${materialColor(mat)}" stroke-width="${Math.max(2, Math.min(10, dimMm / 12))}" stroke-linecap="round"/>`;
    // navn + længde midt på baren (drejet så det kan læses)
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    let deg = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    if (deg > 90) deg -= 180; if (deg < -90) deg += 180;
    const lbl = `${[postLetter(c.a), postLetter(c.b)].sort().join('–')}: ${lenFromSI(span, su).toFixed(2)} ${su === 'ft' ? 'ft' : 'm'}`;
    svg += `<g transform="translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${deg.toFixed(1)})"><rect x="${-lbl.length * 3.3 - 3}" y="-19" width="${lbl.length * 6.6 + 6}" height="14" rx="3" fill="#fff" opacity="0.85"/><text x="0" y="-8" text-anchor="middle" font-size="11" font-weight="600" fill="#111">${lbl}</text></g>`;
  });
  // armgange: trin som tynde streger + M-label i midten (matcher Kort-fanen)
  design.attachments.forEach(at => {
    if (at.type !== 'monkey') return;
    const g = monkeyGeometry(design, at.connA, at.connB, at.spacing_m);
    if (!g) return;
    g.rungs.forEach(r => {
      svg += `<line x1="${sx(r.ax).toFixed(1)}" y1="${sy(r.az).toFixed(1)}" x2="${sx(r.bx).toFixed(1)}" y2="${sy(r.bz).toFixed(1)}" stroke="#0e7490" stroke-width="1.6"/>`;
    });
    const lbl = monkeyLabelOf(design, at);
    svg += `<circle cx="${sx(g.mid.x).toFixed(1)}" cy="${sy(g.mid.z).toFixed(1)}" r="9" fill="#fff" stroke="#0e7490"/><text x="${sx(g.mid.x).toFixed(1)}" y="${(sy(g.mid.z) + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="800" fill="#0e7490">${lbl}</text>`;
  });
  // stiger: markering + S-label ved stolpen
  design.attachments.forEach(at => {
    if (at.type !== 'ladder') return;
    const p = byId[at.postId]; if (!p) return;
    svg += `<text x="${(sx(p.x_m) + 10).toFixed(1)}" y="${(sy(p.z_m) - 10).toFixed(1)}" font-size="13">🪜</text>`;
    svg += `<text x="${(sx(p.x_m) + 28).toFixed(1)}" y="${(sy(p.z_m) - 12).toFixed(1)}" font-size="11" font-weight="800" fill="#0e7490">${ladderLabelOf(design, at)}</text>`;
  });
  // stolper + bogstaver
  const side = Math.max(8, 0.125 * k);
  design.posts.forEach((p, i) => {
    const x = sx(p.x_m), y = sy(p.z_m);
    svg += `<rect x="${(x - side / 2).toFixed(1)}" y="${(y - side / 2).toFixed(1)}" width="${side.toFixed(1)}" height="${side.toFixed(1)}" rx="2" fill="#b6986a" stroke="#5b431f"/>`;
    svg += `<circle cx="${(x + side).toFixed(1)}" cy="${(y - side).toFixed(1)}" r="9" fill="#fff" stroke="#b45309"/><text x="${(x + side).toFixed(1)}" y="${(y - side + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="800" fill="#9a3412">${letterFor(i)}</text>`;
  });
  // målestok: 1 m (metrisk) / 3 fod (imperial) — samme princip som Kort-fanen
  const scM = su === 'ft' ? 3 * 0.3048 : 1, scLbl = su === 'ft' ? '3 ft' : '1 m', scPx = scM * k;
  svg += `<g><line x1="16" y1="${Hp - 14}" x2="${16 + scPx}" y2="${Hp - 14}" stroke="#111" stroke-width="2"/><line x1="16" y1="${Hp - 19}" x2="16" y2="${Hp - 9}" stroke="#111" stroke-width="2"/><line x1="${16 + scPx}" y1="${Hp - 19}" x2="${16 + scPx}" y2="${Hp - 9}" stroke="#111" stroke-width="2"/><text x="${16 + scPx / 2}" y="${Hp - 20}" text-anchor="middle" font-size="11" fill="#111">${scLbl}</text></g>`;
  return `<svg viewBox="0 0 ${Wp} ${Hp}" width="100%" xmlns="http://www.w3.org/2000/svg" style="background:#fff;border:1px solid #999;border-radius:4px">${svg}</svg>`;
}

function printGuide(ctx) {
  // Hent designet fra store'en — ctx.design kan være et løsrevet (stale)
  // objekt efter fortryd/gentag, der erstatter selve design-objektet.
  const design = ctx.store.getDesign(), lang = ctx.lang;
  const tt = k => ctx.t(k, lang);
  if (!design.posts.length) { alert(tt('mats.empty')); return; }
  const M = computeMaterials(design);
  // længder i kortets valgte enhed (som på Kort/Materialer)
  const su = (design.units.site && design.units.site.len) || 'm';
  const suTxt = su === 'ft' ? tt('unit.ft') : tt('unit.m');
  const fm = v => `${fmt(lenFromSI(v, su), 2, lang)} ${suTxt}`;

  const old = document.getElementById('print-root');
  if (old) old.remove();
  const root = el('div', { id: 'print-root' });

  // ---- sidehoved ----
  root.append(
    el('h1', {}, design.meta.name || tt('app.title')),
    el('p', { class: 'pr-sub' }, `${tt('app.title')} — ${tt('print.subtitle')} · ${tt('print.date')}: ${new Date().toLocaleDateString()}`));

  // ---- tegning ----
  root.append(el('h2', {}, tt('print.mapTitle')), el('div', { html: printMapSvg(design) }));

  // ---- stolpetabel ----
  const postHeightOf = p => postHeightOfD(design, p);
  const postDepthOf = p => postDepthOfD(design, p);
  const postHoleOf = p => postHoleMmOf(design, p);
  root.append(el('h2', {}, tt('print.postsTitle')),
    el('table', { class: 'pr-tab' },
      el('thead', {}, el('tr', {},
        el('th', {}, tt('print.th.post')), el('th', {}, tt('print.th.height')),
        el('th', {}, tt('print.th.depth')), el('th', {}, tt('print.th.hole')))),
      el('tbody', {}, ...design.posts.map((p, i) => el('tr', {},
        el('td', {}, letterFor(i)), el('td', {}, fm(postHeightOf(p))),
        el('td', {}, fm(postDepthOf(p))), el('td', {}, `${Math.round(postHoleOf(p) / 10)} × ${Math.round(postHoleOf(p) / 10)} cm`))))));

  // ---- forbindelsestabel ----
  const byId = Object.fromEntries(design.posts.map(p => [p.id, p]));
  const connMat = ref => connMatOf(design, ref);
  const postLetter = id => postLetterOf(design, id);
  root.append(el('h2', {}, tt('print.connsTitle')),
    el('table', { class: 'pr-tab' },
      el('thead', {}, el('tr', {},
        el('th', {}, tt('print.th.conn')), el('th', {}, tt('print.th.mat')),
        el('th', {}, tt('print.th.connheight')), el('th', {}, tt('print.th.span')))),
      el('tbody', {}, ...design.connections.map(c => {
        const a = byId[c.a], b = byId[c.b];
        const span = (a && b) ? Math.hypot(b.x_m - a.x_m, b.z_m - a.z_m) : 0;
        return el('tr', {},
          el('td', {}, [postLetter(c.a), postLetter(c.b)].sort().join('–')),
          el('td', {}, connMat(c.material).name),
          el('td', {}, fm(c.height_m)), el('td', {}, fm(span)));
      }))));

  // ---- materialeliste (samme tal som Materialer-fanen) ----
  const rows = [];
  rows.push([`${M.postMat.name} (${tt('mats.posts')})`, `${M.postCount} ${tt('mats.pcs')} · ${fm(M.postTotalLen)} ${tt('mats.total')}`]);
  for (const id of Object.keys(M.barGroups)) {
    const g = M.barGroups[id];
    rows.push([g.mat.name, `${g.count} ${tt('mats.pcs')} · ${fm(g.totalLen)} ${tt('mats.total')}`]);
  }
  if (M.pipeConnCount > 0) rows.push([tt('mats.fittings'), `${M.pipeConnCount * 2} ${tt('mats.pcs')}`]);
  if (M.ladderCount > 0) {
    rows.push([tt('mats.ladderVert'), fm(M.ladVert)]);
    rows.push([`${tt('mats.ladderRungs')} (${M.ladRungCount} ${tt('mats.pcs')})`, fm(M.ladRungLen)]);
    rows.push([tt('mats.ladderKee'), `${M.ladKee} ${tt('mats.pcs')}`]);
  }
  if (M.monkeyCount > 0) {
    rows.push([`${tt('mats.monkeyRungs')} (${M.monRungCount} ${tt('mats.pcs')})`, fm(M.monRungLen)]);
    rows.push([tt('mats.monkeyKee'), `${M.monKee} ${tt('mats.pcs')}`]);
  }
  rows.push([tt('mats.screws'), `~${32 + (M.ladRungCount + M.monRungCount) * 4} ${tt('mats.pcs')}`]);
  rows.push([tt('mats.gravel'), `${Math.round(M.gravelVol * 1000)} L`]);
  rows.push([`${tt('mats.concrete')} (${tt('mats.bags')})`, `${fmt(M.concVol, 2, lang)} m³ (~${M.bags25})`]);
  rows.push([tt('mats.tar'), `~${fmt(M.tarLitre, 1, lang)} L`]);
  root.append(el('h2', {}, tt('mats.tableTitle')),
    el('table', { class: 'pr-tab' }, el('tbody', {}, ...rows.map(r =>
      el('tr', {}, el('td', {}, r[0]), el('td', { class: 'pr-q' }, r[1]))))));

  // ---- skæreliste (tekstform pr. materiale) ----
  root.append(el('h2', {}, tt('mats.cutTitle')));
  for (const id of Object.keys(M.cut).sort()) {
    const grp = M.cut[id];
    const stockLen = (design.stock && design.stock[id]) || (grp.mat.kind === 'wood' ? 4.8 : STOCK);
    const { bars, count } = packPieces(grp.pieces, stockLen, KERF);
    root.append(el('p', { class: 'pr-cut-h' }, `${grp.mat.name}: ${count} × ${fm(stockLen)} (${tt('mats.stockLen').toLowerCase()})`));
    const ul = el('ul', { class: 'pr-cut' });
    bars.forEach((b, bi) => {
      const list = b.pieces.map(p => `${p.label} ${fmt(p.len, 2, lang)}`).join(' · ');
      ul.append(el('li', {}, `#${bi + 1}: ${list}${b.waste > 0.01 ? ` · ${tt('mats.waste')} ${fm(b.waste)}` : ''}`));
    });
    root.append(ul);
  }
  root.append(el('p', { class: 'pr-note' }, `${tt('mats.cutTotal3')} ${KERF * 1000} mm. ${tt('mats.assume2')}`));

  // ---- støbe-trin ----
  root.append(el('h2', {}, tt('print.how')),
    el('ol', { class: 'pr-steps' }, ...[1, 2, 3, 4, 5].map(n => el('li', {}, tt('print.step' + n)))));

  root.append(el('p', { class: 'pr-note' }, tt('disclaimer')));

  document.body.append(root);
  const cleanup = () => { root.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
