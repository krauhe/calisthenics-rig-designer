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
  // Fundamenthuller først; tværsnittene bruger kortets faktiske målestok.
  let svg = '';
  design.posts.forEach(p => {
    const hole = postHoleMmOf(design, p) / 1000 * k, x = sx(p.x_m), y = sy(p.z_m);
    svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(hole/2).toFixed(1)}" fill="#eee" stroke="#777" stroke-width="1" stroke-dasharray="4 3"/>`;
  });
  design.connections.forEach(c => {
    const a = byId[c.a], b = byId[c.b]; if (!a || !b) return;
    const mat = connMat(c.material);
    const dimMm = mat.kind === 'wood' ? mat.side : mat.od;
    const span = spanOfConn(design, c);
    const x1 = sx(a.x_m), y1 = sy(a.z_m), x2 = sx(b.x_m), y2 = sy(b.z_m);
    svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${materialColor(mat)}" stroke-width="${Math.max(1, dimMm / 1000 * k).toFixed(1)}" stroke-linecap="butt"/>`;
    // navn + længde midt på baren (drejet så det kan læses)
    const dx = x2 - x1, dy = y2 - y1, dl = Math.hypot(dx, dy) || 1;
    const wdx = b.x_m - a.x_m, wdz = b.z_m - a.z_m, wlen = Math.hypot(wdx, wdz) || 1;
    const wux = wdx / wlen, wuz = wdz / wlen;
    const axf = x1 + dx / dl * postFaceOffset(design, a, wux, wuz) * k;
    const ayf = y1 + dy / dl * postFaceOffset(design, a, wux, wuz) * k;
    const bxf = x2 - dx / dl * postFaceOffset(design, b, -wux, -wuz) * k;
    const byf = y2 - dy / dl * postFaceOffset(design, b, -wux, -wuz) * k;
    const nx = -dy / dl, ny = dx / dl, off = 18;
    const d1x = axf + nx * off, d1y = ayf + ny * off, d2x = bxf + nx * off, d2y = byf + ny * off;
    svg += `<line x1="${axf.toFixed(1)}" y1="${ayf.toFixed(1)}" x2="${d1x.toFixed(1)}" y2="${d1y.toFixed(1)}" stroke="#555" stroke-width="0.8"/><line x1="${bxf.toFixed(1)}" y1="${byf.toFixed(1)}" x2="${d2x.toFixed(1)}" y2="${d2y.toFixed(1)}" stroke="#555" stroke-width="0.8"/><line x1="${d1x.toFixed(1)}" y1="${d1y.toFixed(1)}" x2="${d2x.toFixed(1)}" y2="${d2y.toFixed(1)}" stroke="#111" stroke-width="1"/><line x1="${(d1x-nx*4).toFixed(1)}" y1="${(d1y-ny*4).toFixed(1)}" x2="${(d1x+nx*4).toFixed(1)}" y2="${(d1y+ny*4).toFixed(1)}" stroke="#111"/><line x1="${(d2x-nx*4).toFixed(1)}" y1="${(d2y-ny*4).toFixed(1)}" x2="${(d2x+nx*4).toFixed(1)}" y2="${(d2y+ny*4).toFixed(1)}" stroke="#111"/>`;
    const mx = (d1x + d2x) / 2, my = (d1y + d2y) / 2;
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
  // Stiger i plan: post til lodret yderrør, inkl. eget runde fundament.
  design.attachments.forEach(at => {
    if (at.type !== 'ladder') return;
    const p = byId[at.postId]; if (!p) return;
    const bar = ladderBarOf(design, at), dx = bar ? bar.dx : Math.cos(at.angle_rad || 0), dz = bar ? bar.dz : Math.sin(at.angle_rad || 0);
    const width = Math.max(0.05, at.width_m || 0.5), vx = p.x_m + dx * width, vz = p.z_m + dz * width;
    const x1 = sx(p.x_m), y1 = sy(p.z_m), x2 = sx(vx), y2 = sy(vz), foot = ladderHoleMmOf(at) / 1000 * k, pipe = Math.max(2, 0.0337 * k);
    svg += `<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="${(foot/2).toFixed(1)}" fill="#eee" stroke="#777" stroke-dasharray="4 3"/>`;
    svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#0e7490" stroke-width="${pipe.toFixed(1)}"/><circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="${(pipe/2).toFixed(1)}" fill="#0e7490"/>`;
    svg += `<text x="${(x2+8).toFixed(1)}" y="${(y2-8).toFixed(1)}" font-size="11" font-weight="800" fill="#0e7490">${ladderLabelOf(design, at)} · ${lenFromSI(width, su).toFixed(2)} ${su === 'ft' ? 'ft' : 'm'}</text>`;
  });
  // stolper + bogstaver
  design.posts.forEach((p, i) => {
    const x = sx(p.x_m), y = sy(p.z_m);
    const pm = postMatOf(design, p), side = Math.max(1, (pm.kind === 'wood' ? pm.side : pm.od) / 1000 * k);
    if (pm.kind === 'pipe') svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(side/2).toFixed(1)}" fill="#83b7d9" stroke="#333"/>`;
    else svg += `<rect x="${(x - side / 2).toFixed(1)}" y="${(y - side / 2).toFixed(1)}" width="${side.toFixed(1)}" height="${side.toFixed(1)}" rx="1" fill="#b6986a" stroke="#5b431f"/>`;
    svg += `<circle cx="${(x + side).toFixed(1)}" cy="${(y - side).toFixed(1)}" r="9" fill="#fff" stroke="#b45309"/><text x="${(x + side).toFixed(1)}" y="${(y - side + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="800" fill="#9a3412">${letterFor(i)}</text>`;
  });
  // målestok: 1 m (metrisk) / 3 fod (imperial) — samme princip som Kort-fanen
  const scM = su === 'ft' ? 3 * 0.3048 : 1, scLbl = su === 'ft' ? '3 ft' : '1 m', scPx = scM * k;
  svg += `<g><line x1="16" y1="${Hp - 14}" x2="${16 + scPx}" y2="${Hp - 14}" stroke="#111" stroke-width="2"/><line x1="16" y1="${Hp - 19}" x2="16" y2="${Hp - 9}" stroke="#111" stroke-width="2"/><line x1="${16 + scPx}" y1="${Hp - 19}" x2="${16 + scPx}" y2="${Hp - 9}" stroke="#111" stroke-width="2"/><text x="${16 + scPx / 2}" y="${Hp - 20}" text-anchor="middle" font-size="11" fill="#111">${scLbl}</text></g>`;
  return `<svg viewBox="0 0 ${Wp} ${Hp}" width="100%" xmlns="http://www.w3.org/2000/svg" style="background:#fff;border:1px solid #999;border-radius:4px">${svg}</svg>`;
}

// Målsat sidevisning af én forbindelse med stolpehøjder, fri længde,
// overkantshøjde, nedgravning, hulmål og materialedimensioner.
function printConnectionElevationLegacy(design, c, lang) {
  const su = (design.units.site && design.units.site.len) || 'm';
  const unit = su === 'ft' ? 'ft' : 'm';
  const fm = v => `${fmt(lenFromSI(v, su), 2, lang)} ${unit}`;
  const a = design.posts.find(p => p.id === c.a), b = design.posts.find(p => p.id === c.b);
  if (!a || !b) return '';
  const la = postLetterOf(design, a.id), lb = postLetterOf(design, b.id);
  const ha = postHeightOfD(design, a), hb = postHeightOfD(design, b);
  const da = postDepthOfD(design, a), db = postDepthOfD(design, b);
  const holeA = postHoleMmOf(design, a), holeB = postHoleMmOf(design, b);
  const ma = postMatOf(design, a), mb = postMatOf(design, b), cm = connMatOf(design, c.material);
  const dim = m => m.kind === 'wood' ? `${fmt(m.side, 0, lang)} x ${fmt(m.side, 0, lang)} mm` : `Ø ${fmt(m.od, 1, lang)} x ${fmt(m.wall, 1, lang)} mm`;
  const ground = 205, topScale = 145 / Math.max(ha, hb, c.height_m, 0.5), depthScale = 55 / Math.max(da, db, 0.5);
  // Fælles tværsnitsmålestok: hul, stolpe, bjælke og stigerør har korrekte
  // indbyrdes tykkelser, selv om længde/højde skaleres separat for læsbarhed.
  const sectionScale = 120;
  const sectionM = m => ((m.kind === 'wood' ? m.side : m.od) || 0) / 1000;
  const xA = 105, xB = 535, pwA = Math.max(2, sectionM(ma) * sectionScale), pwB = Math.max(2, sectionM(mb) * sectionScale);
  const holePxA = Math.max(pwA, holeA / 1000 * sectionScale), holePxB = Math.max(pwB, holeB / 1000 * sectionScale);
  const barThickness = Math.max(2, sectionM(cm) * sectionScale);
  const yTopA = ground - ha * topScale, yTopB = ground - hb * topScale, yBar = ground - c.height_m * topScale;
  const yBotA = ground + da * depthScale, yBotB = ground + db * depthScale;
  const clear = spanOfConn(design, c), id = String(c.id).replace(/[^a-zA-Z0-9_-]/g, '');
  const arrow = `pr-arr-${id}`;
  const vdim = (x, y1, y2, label, side) => `<line x1="${x}" y1="${y1.toFixed(1)}" x2="${x}" y2="${y2.toFixed(1)}" stroke="#64748b" marker-start="url(#${arrow})" marker-end="url(#${arrow})"/><text x="${x + side * 7}" y="${((y1+y2)/2).toFixed(1)}" transform="rotate(-90 ${x + side * 7} ${((y1+y2)/2).toFixed(1)})" text-anchor="middle" font-size="10" fill="#475569">${label}</text>`;
  const connName = connLabelOf(design, c);
  const centerSpan = Math.hypot(b.x_m - a.x_m, b.z_m - a.z_m) || 1;
  const spanScale = (xB - xA) / centerSpan;
  let ladderSvg = '';
  design.attachments.forEach(at => {
    if (at.type !== 'ladder') return;
    const bar = ladderBarOf(design, at); if (!bar || !bar.conn || bar.conn.id !== c.id) return;
    const onA = at.postId === a.id, onB = at.postId === b.id; if (!onA && !onB) return;
    const sign = onA ? 1 : -1, postX = onA ? xA : xB, postW = onA ? pwA : pwB;
    const width = Math.max(0.05, at.width_m || 0.5), railX = postX + sign * width * spanScale;
    const pipeW = Math.max(2, 0.0337 * sectionScale), railBottom = ground + ladderDepthOf(at) * depthScale;
    const footW = ladderHoleMmOf(at) / 1000 * sectionScale;
    ladderSvg += `<rect x="${(railX-footW/2).toFixed(1)}" y="${ground}" width="${footW.toFixed(1)}" height="${(railBottom-ground).toFixed(1)}" fill="#eee" stroke="#777" stroke-dasharray="4 3"/>`;
    ladderSvg += `<line x1="${railX.toFixed(1)}" y1="${yBar.toFixed(1)}" x2="${railX.toFixed(1)}" y2="${railBottom.toFixed(1)}" stroke="#0e7490" stroke-width="${pipeW.toFixed(1)}"/>`;
    for (let h = ladderRungSpacingOf(at); h <= c.height_m - 0.25 + 1e-9; h += ladderRungSpacingOf(at)) {
      const y = ground - h * topScale, postFace = postX + sign * postW / 2;
      ladderSvg += `<line x1="${postFace.toFixed(1)}" y1="${y.toFixed(1)}" x2="${railX.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#0e7490" stroke-width="${pipeW.toFixed(1)}"/>`;
    }
    ladderSvg += `<text x="${(railX+sign*8).toFixed(1)}" y="${(yBar-7).toFixed(1)}" text-anchor="${sign > 0 ? 'start' : 'end'}" font-size="10" font-weight="700" fill="#0e7490">${ladderLabelOf(design, at)} · ${fm(width)}</text>`;
  });
  return `<svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${connName}">
    <defs><marker id="${arrow}" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0,0 L10,5 L0,10 Z" fill="#64748b"/></marker></defs>
    <rect width="640" height="320" fill="#fff"/><text x="18" y="20" font-size="15" font-weight="700">${connName}</text>
    <line x1="25" y1="${ground}" x2="615" y2="${ground}" stroke="#222" stroke-width="1.5"/><text x="28" y="199" font-size="9">jordlinje</text>
    <rect x="${(xA-holePxA/2).toFixed(1)}" y="${ground}" width="${holePxA.toFixed(1)}" height="${(yBotA-ground).toFixed(1)}" fill="#eee" stroke="#777" stroke-dasharray="4 3"/>
    <rect x="${(xB-holePxB/2).toFixed(1)}" y="${ground}" width="${holePxB.toFixed(1)}" height="${(yBotB-ground).toFixed(1)}" fill="#eee" stroke="#777" stroke-dasharray="4 3"/>
    <rect x="${(xA-pwA/2).toFixed(1)}" y="${yTopA.toFixed(1)}" width="${pwA.toFixed(1)}" height="${(yBotA-yTopA).toFixed(1)}" fill="${materialColor(ma)}" stroke="#333"/>
    <rect x="${(xB-pwB/2).toFixed(1)}" y="${yTopB.toFixed(1)}" width="${pwB.toFixed(1)}" height="${(yBotB-yTopB).toFixed(1)}" fill="${materialColor(mb)}" stroke="#333"/>
    <line x1="${(xA+pwA/2).toFixed(1)}" y1="${yBar.toFixed(1)}" x2="${(xB-pwB/2).toFixed(1)}" y2="${yBar.toFixed(1)}" stroke="${materialColor(cm)}" stroke-width="${barThickness.toFixed(1)}" stroke-linecap="butt"/>
    ${ladderSvg}
    <line x1="${xA+pwA/2}" y1="42" x2="${xB-pwB/2}" y2="42" stroke="#64748b" marker-start="url(#${arrow})" marker-end="url(#${arrow})"/><text x="320" y="36" text-anchor="middle" font-size="11" font-weight="700" fill="#475569">fri L = ${fm(clear)}</text>
    ${vdim(67, yTopA, ground, `${la}: ${fm(ha)}`, -1)}${vdim(573, yTopB, ground, `${lb}: ${fm(hb)}`, 1)}${vdim(505, yBar, ground, `bar: ${fm(c.height_m)}`, -1)}
    <text x="${xA}" y="278" text-anchor="middle" font-size="9">dybde ${fm(da)} - hul ${Math.round(holeA/10)} x ${Math.round(holeA/10)} cm</text>
    <text x="${xB}" y="278" text-anchor="middle" font-size="9">dybde ${fm(db)} - hul ${Math.round(holeB/10)} x ${Math.round(holeB/10)} cm</text>
    <text x="18" y="307" font-size="9">${la}: ${dim(ma)} | ${lb}: ${dim(mb)} | forbindelse: ${esc(matLabel(cm, 'mm', lang))}</text>
  </svg>`;
}

// Render den samme scene som 3D-fanen i et midlertidigt offscreen-element og
// frys den som PNG. preserveDrawingBuffer er allerede slået til i build3d().
// One common physical scale for every connection drawing. SVG user units are
// millimetres on the printed A4 page, so horizontal, vertical and section
// dimensions can never be stretched independently.
function printElevationScale(design) {
  const byId = Object.fromEntries(design.posts.map(p => [p.id, p]));
  const maxSpan = Math.max(0.1, ...design.connections.map(c => {
    const a = byId[c.a], b = byId[c.b];
    return a && b ? Math.hypot(b.x_m - a.x_m, b.z_m - a.z_m) : 0;
  }));
  const maxAbove = Math.max(0.5, ...design.posts.map(p => postHeightOfD(design, p)), ...design.connections.map(c => c.height_m || 0));
  const maxDepth = Math.max(0.5, ...design.posts.map(p => postDepthOfD(design, p)),
    ...design.attachments.filter(a => a.type === 'ladder').map(a => ladderDepthOf(a)));
  const denominator = [25, 50, 100, 200].find(d =>
    maxSpan * 1000 / d <= 140 && (maxAbove + maxDepth) * 1000 / d <= 199) || 200;
  return { denominator, mmPerM: 1000 / denominator, maxAbove, maxDepth };
}

function printConnectionElevation(design, c, lang) {
  const su = (design.units.site && design.units.site.len) || 'm';
  const unit = su === 'ft' ? 'ft' : 'm';
  const fm = v => `${fmt(lenFromSI(v, su), 2, lang)} ${unit}`;
  const a = design.posts.find(p => p.id === c.a), b = design.posts.find(p => p.id === c.b);
  if (!a || !b) return '';
  const la = postLetterOf(design, a.id), lb = postLetterOf(design, b.id);
  const ha = postHeightOfD(design, a), hb = postHeightOfD(design, b);
  const da = postDepthOfD(design, a), db = postDepthOfD(design, b);
  const holeA = postHoleMmOf(design, a), holeB = postHoleMmOf(design, b);
  const ma = postMatOf(design, a), mb = postMatOf(design, b), cm = connMatOf(design, c.material);
  const dim = m => m.kind === 'wood' ? `${fmt(m.side, 0, lang)} × ${fmt(m.side, 0, lang)} mm` : `Ø ${fmt(m.od, 1, lang)} × ${fmt(m.wall, 1, lang)} mm`;
  const scale = printElevationScale(design), k = scale.mmPerM;
  const ground = 31 + scale.maxAbove * k;
  const sectionM = m => ((m.kind === 'wood' ? m.side : m.od) || 0) / 1000;
  const centerSpan = Math.hypot(b.x_m - a.x_m, b.z_m - a.z_m) || 1;
  const xA = 95 - centerSpan * k / 2, xB = 95 + centerSpan * k / 2;
  const pwA = sectionM(ma) * k, pwB = sectionM(mb) * k;
  const holePxA = holeA / 1000 * k, holePxB = holeB / 1000 * k;
  const barThickness = sectionM(cm) * k;
  const yTopA = ground - ha * k, yTopB = ground - hb * k, yBar = ground - c.height_m * k;
  const yBotA = ground + da * k, yBotB = ground + db * k;
  const badgeYA = yTopA + 6, badgeYB = yTopB + 6;
  const clear = spanOfConn(design, c), id = String(c.id).replace(/[^a-zA-Z0-9_-]/g, '');
  const arrow = `pr-arr-${id}`;
  const vdim = (x, y1, y2, label, side) => `<line x1="${x.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#64748b" stroke-width="0.35" marker-start="url(#${arrow})" marker-end="url(#${arrow})"/><text x="${(x + side * 3.5).toFixed(1)}" y="${((y1 + y2) / 2).toFixed(1)}" transform="rotate(-90 ${(x + side * 3.5).toFixed(1)} ${((y1 + y2) / 2).toFixed(1)})" text-anchor="middle" font-size="3" fill="#475569">${label}</text>`;
  const connName = connLabelOf(design, c);
  let ladderSvg = '';
  design.attachments.forEach(at => {
    if (at.type !== 'ladder') return;
    const bar = ladderBarOf(design, at); if (!bar || !bar.conn || bar.conn.id !== c.id) return;
    const onA = at.postId === a.id, onB = at.postId === b.id; if (!onA && !onB) return;
    const sign = onA ? 1 : -1, postX = onA ? xA : xB, postW = onA ? pwA : pwB;
    const width = Math.max(0.05, at.width_m || 0.5), railX = postX + sign * width * k;
    const pipeW = 0.0337 * k, railBottom = ground + ladderDepthOf(at) * k, footW = ladderHoleMmOf(at) / 1000 * k;
    ladderSvg += `<rect x="${(railX - footW / 2).toFixed(1)}" y="${ground.toFixed(1)}" width="${footW.toFixed(1)}" height="${(railBottom - ground).toFixed(1)}" fill="#eee" stroke="#777" stroke-width="0.3" stroke-dasharray="1.2 0.8"/>`;
    ladderSvg += `<line x1="${railX.toFixed(1)}" y1="${yBar.toFixed(1)}" x2="${railX.toFixed(1)}" y2="${railBottom.toFixed(1)}" stroke="#0e7490" stroke-width="${pipeW.toFixed(2)}"/>`;
    // Fittings vises skematisk: fyldt firkant = normalt beslag mod stolpen,
    // ring = T-stykke på yderrøret. Der sidder også et T i toppen.
    ladderSvg += `<circle cx="${railX.toFixed(1)}" cy="${yBar.toFixed(1)}" r="1.25" fill="#fff" stroke="#111" stroke-width="0.5"/>`;
    for (let h = ladderRungSpacingOf(at); h <= c.height_m - 0.25 + 1e-9; h += ladderRungSpacingOf(at)) {
      const y = ground - h * k, postFace = postX + sign * postW / 2;
      ladderSvg += `<line x1="${postFace.toFixed(1)}" y1="${y.toFixed(1)}" x2="${railX.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#0e7490" stroke-width="${pipeW.toFixed(2)}"/>`;
      ladderSvg += `<rect x="${(postFace - 1).toFixed(1)}" y="${(y - 1).toFixed(1)}" width="2" height="2" fill="#111"/><circle cx="${railX.toFixed(1)}" cy="${y.toFixed(1)}" r="1.25" fill="#fff" stroke="#111" stroke-width="0.5"/>`;
    }
    ladderSvg += `<text x="${(railX + sign * 3).toFixed(1)}" y="${(yBar - 3).toFixed(1)}" text-anchor="${sign > 0 ? 'start' : 'end'}" font-size="3" font-weight="700" fill="#0e7490">${ladderLabelOf(design, at)} · ${fm(width)} · Ø${Math.round(ladderHoleMmOf(at) / 10)} cm · □ stolpebeslag · ○ T</text>`;
  });
  const scaleX2 = 185, scaleX1 = scaleX2 - k;
  const tx = lang === 'en'
    ? { scale: 'Scale', actual: 'Print at 100% / actual size', ground: 'finished ground', depth: 'depth', hole: 'hole', bar: 'bar', clear: 'clear L' }
    : { scale: 'Målestok', actual: 'Udskriv ved 100 % / faktisk størrelse', ground: 'færdig jord', depth: 'dybde', hole: 'hul', bar: 'bar', clear: 'fri L' };
  return `<svg viewBox="0 0 190 250" width="190mm" height="250mm" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${connName}">
    <defs><marker id="${arrow}" markerWidth="4.5" markerHeight="4.5" refX="3.8" refY="2.25" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0,0 L4.5,2.25 L0,4.5 Z" fill="#64748b"/></marker></defs>
    <rect width="190" height="250" fill="#fff"/><text x="5" y="7" font-size="5" font-weight="700">${connName}</text>
    <text x="5" y="13" font-size="3.2" font-weight="700">${tx.scale} 1:${scale.denominator}</text><text x="5" y="18" font-size="2.8">${tx.actual}</text>
    <g><line x1="${scaleX1}" y1="14" x2="${scaleX2}" y2="14" stroke="#111" stroke-width="0.7"/><line x1="${scaleX1}" y1="11.5" x2="${scaleX1}" y2="16.5" stroke="#111" stroke-width="0.7"/><line x1="${scaleX2}" y1="11.5" x2="${scaleX2}" y2="16.5" stroke="#111" stroke-width="0.7"/><text x="${(scaleX1 + scaleX2) / 2}" y="10" text-anchor="middle" font-size="3.2" font-weight="700">1 m</text></g>
    <line x1="5" y1="${ground.toFixed(1)}" x2="185" y2="${ground.toFixed(1)}" stroke="#222" stroke-width="0.5"/><text x="6" y="${(ground - 1.5).toFixed(1)}" font-size="2.7">${tx.ground}</text>
    <rect x="${(xA - holePxA / 2).toFixed(1)}" y="${ground.toFixed(1)}" width="${holePxA.toFixed(1)}" height="${(yBotA - ground).toFixed(1)}" fill="#eee" stroke="#777" stroke-width="0.3" stroke-dasharray="1.2 0.8"/>
    <rect x="${(xB - holePxB / 2).toFixed(1)}" y="${ground.toFixed(1)}" width="${holePxB.toFixed(1)}" height="${(yBotB - ground).toFixed(1)}" fill="#eee" stroke="#777" stroke-width="0.3" stroke-dasharray="1.2 0.8"/>
    <rect x="${(xA - pwA / 2).toFixed(1)}" y="${yTopA.toFixed(1)}" width="${pwA.toFixed(2)}" height="${(yBotA - yTopA).toFixed(1)}" fill="${materialColor(ma)}" stroke="#333" stroke-width="0.3"/>
    <rect x="${(xB - pwB / 2).toFixed(1)}" y="${yTopB.toFixed(1)}" width="${pwB.toFixed(2)}" height="${(yBotB - yTopB).toFixed(1)}" fill="${materialColor(mb)}" stroke="#333" stroke-width="0.3"/>
    <line x1="${(xA + pwA / 2).toFixed(1)}" y1="${yBar.toFixed(1)}" x2="${(xB - pwB / 2).toFixed(1)}" y2="${yBar.toFixed(1)}" stroke="${materialColor(cm)}" stroke-width="${barThickness.toFixed(2)}" stroke-linecap="butt"/>
    ${ladderSvg}
    <g aria-label="Stolpe ${la}"><circle cx="${xA.toFixed(1)}" cy="${badgeYA.toFixed(1)}" r="3.5" fill="#fff7ed" stroke="#b45309" stroke-width="0.7"/><text x="${xA.toFixed(1)}" y="${(badgeYA + 1.5).toFixed(1)}" text-anchor="middle" font-size="4.3" font-weight="800" fill="#9a3412">${la}</text></g>
    <g aria-label="Stolpe ${lb}"><circle cx="${xB.toFixed(1)}" cy="${badgeYB.toFixed(1)}" r="3.5" fill="#fff7ed" stroke="#b45309" stroke-width="0.7"/><text x="${xB.toFixed(1)}" y="${(badgeYB + 1.5).toFixed(1)}" text-anchor="middle" font-size="4.3" font-weight="800" fill="#9a3412">${lb}</text></g>
    <line x1="${(xA + pwA / 2).toFixed(1)}" y1="24" x2="${(xB - pwB / 2).toFixed(1)}" y2="24" stroke="#64748b" stroke-width="0.35" marker-start="url(#${arrow})" marker-end="url(#${arrow})"/><text x="95" y="22" text-anchor="middle" font-size="3.2" font-weight="700" fill="#475569">${tx.clear} = ${fm(clear)}</text>
    ${vdim(xA - pwA / 2 - 5, yTopA, ground, `${la}: ${fm(ha)}`, -1)}${vdim(xB + pwB / 2 + 5, yTopB, ground, `${lb}: ${fm(hb)}`, 1)}${vdim(xB - pwB / 2 - 5, yBar, ground, `${tx.bar}: ${fm(c.height_m)}`, -1)}
    <text x="${xA.toFixed(1)}" y="239" text-anchor="middle" font-size="2.7">${tx.depth} ${fm(da)} · ${tx.hole} Ø ${Math.round(holeA / 10)} cm</text>
    <text x="${xB.toFixed(1)}" y="244" text-anchor="middle" font-size="2.7">${tx.depth} ${fm(db)} · ${tx.hole} Ø ${Math.round(holeB / 10)} cm</text>
    <text x="5" y="249" font-size="2.6">${la}: ${dim(ma)} | ${lb}: ${dim(mb)} | forbindelse: ${esc(matLabel(cm, 'mm', lang))}</text>
  </svg>`;
}

async function print3dPng(design, ctx) {
  let host = null;
  try {
    const THREE = await ensureThree();
    host = el('div', { class: 'print-3d-render-host' });
    host.style.cssText = 'position:fixed;left:-12000px;top:0;width:1200px;height:750px;pointer-events:none;z-index:-1;';
    document.body.append(host);
    build3d(THREE, host, design, ctx);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = host.querySelector('canvas');
    if (!canvas || canvas.width < 2 || canvas.height < 2) throw new Error('3D-canvas blev ikke renderet');
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('3D-printvisning fejlede:', err);
    return '';
  } finally {
    if (host) host.remove();
  }
}

async function printGuide(ctx) {
  // Hent designet fra store'en — ctx.design kan være et løsrevet (stale)
  // objekt efter fortryd/gentag, der erstatter selve design-objektet.
  const design = ctx.store.getDesign(), lang = ctx.lang;
  const tt = k => ctx.t(k, lang);
  if (!design.posts.length) { alert(tt('mats.empty')); return; }
  const M = computeMaterials(design);
  const view3dPng = await print3dPng(design, ctx);
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

  // ---- tegninger: grundplan og fast 3D-kameravinkel ----
  const visuals = el('div', { class: 'pr-visuals' },
    el('section', { class: 'pr-visual' },
      el('h2', {}, tt('print.mapTitle')),
      el('div', { class: 'pr-map', html: printMapSvg(design) })),
    el('section', { class: 'pr-visual' },
      el('h2', {}, tt('print.3dTitle')),
      view3dPng
        ? el('img', { class: 'pr-3d-img', src: view3dPng, alt: tt('print.3dTitle') })
        : el('p', { class: 'pr-note' }, tt('print.3dFailed'))));
  root.append(visuals);

  // ---- målsatte sidevisninger: én arbejdstegning pr. forbindelse ----
  root.append(el('section', { class: 'pr-elevations' },
    el('h2', {}, tt('print.elevTitle')),
    el('p', { class: 'pr-note pr-elev-note' }, tt('print.elevHint')),
    el('div', { class: 'pr-elev-grid' }, ...design.connections.map(c =>
      el('div', { class: 'pr-elev', html: printConnectionElevation(design, c, lang) })))));

  // ---- stolpetabel ----
  const postHeightOf = p => postHeightOfD(design, p);
  const postDepthOf = p => postDepthOfD(design, p);
  const postHoleOf = p => postHoleMmOf(design, p);
  root.append(el('h2', {}, tt('print.postsTitle')),
    el('p', { class: 'pr-note' }, `${tt('site.refload')}: ${fmt(design.site.refLoad_kg ?? 120, 0, lang)} kg · ${tt('site.postrefload')}: ${fmt(design.site.postRefLoad_kg ?? 50, 0, lang)} kg · ${tt('site.soil')}: ${tt('site.soil.' + (design.site.soil || 'normal'))}`),
    el('table', { class: 'pr-tab' },
      el('thead', {}, el('tr', {},
        el('th', {}, tt('print.th.post')), el('th', {}, tt('print.th.mat')), el('th', {}, tt('print.th.height')),
        el('th', {}, tt('print.th.depth')), el('th', {}, tt('print.th.hole')))),
      el('tbody', {}, ...design.posts.map((p, i) => el('tr', {},
        el('td', {}, letterFor(i)), el('td', {}, matLabel(postMatOf(design, p), 'mm', lang)), el('td', {}, fm(postHeightOf(p))),
        el('td', {}, fm(postDepthOf(p))), el('td', {}, `Ø ${Math.round(postHoleOf(p) / 10)} cm`))))));

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
        const span = spanOfConn(design, c);
        return el('tr', {},
          el('td', {}, [postLetter(c.a), postLetter(c.b)].sort().join('–')),
          el('td', {}, matLabel(connMat(c.material), 'mm', lang)),
          el('td', {}, fm(c.height_m)), el('td', {}, fm(span)));
      }))));

  // ---- stiger: egne fundamentmål og trinafstand skal med på byggetegningen ----
  const ladders = design.attachments.filter(a => a.type === 'ladder');
  if (ladders.length) {
    root.append(el('h2', {}, tt('print.laddersTitle')),
      el('table', { class: 'pr-tab' },
        el('thead', {}, el('tr', {},
          el('th', {}, '#'), el('th', {}, tt('site.ladder.post')), el('th', {}, tt('site.ladder.bar')),
          el('th', {}, tt('site.ladderwidth')), el('th', {}, tt('site.ladder.depth')),
          el('th', {}, tt('site.ladder.hole')), el('th', {}, tt('site.ladder.rungs')))),
        el('tbody', {}, ...ladders.map(at => {
          const bar = ladderBarOf(design, at);
          return el('tr', {},
            el('td', {}, ladderLabelOf(design, at)), el('td', {}, postLetterOf(design, at.postId)),
            el('td', {}, bar ? connLabelOf(design, bar.conn) : '—'), el('td', {}, fm(at.width_m)),
            el('td', {}, fm(ladderDepthOf(at))), el('td', {}, `Ø ${Math.round(ladderHoleMmOf(at) / 10)} cm`),
            el('td', {}, `${Math.round(ladderRungSpacingOf(at) * 100)} cm`));
        }))));
  }

  // ---- materialeliste (samme tal som Materialer-fanen) ----
  const rows = [];
  for (const id of Object.keys(M.postGroups)) {
    const g = M.postGroups[id];
    rows.push([`${matLabel(g.mat, 'mm', lang)} (${tt('mats.posts')})`, `${g.count} ${tt('mats.pcs')} · ${fm(g.totalLen)} ${tt('mats.total')}`]);
  }
  for (const id of Object.keys(M.barGroups)) {
    const g = M.barGroups[id];
    rows.push([matLabel(g.mat, 'mm', lang), `${g.count} ${tt('mats.pcs')} · ${fm(g.totalLen)} ${tt('mats.total')}`]);
  }
  if (M.pipeConnCount > 0) rows.push([tt('mats.fittings'), `${M.pipeConnCount * 2} ${tt('mats.pcs')}`]);
  if (M.ladderCount > 0) {
    rows.push([tt('mats.ladderVert'), fm(M.ladVert)]);
    rows.push([`${tt('mats.ladderRungs')} (${M.ladRungCount} ${tt('mats.pcs')})`, fm(M.ladRungLen)]);
    rows.push([tt('mats.ladderPostFittings'), `${M.ladPostFittings} ${tt('mats.pcs')}`]);
    rows.push([tt('mats.ladderTees'), `${M.ladTees} ${tt('mats.pcs')}`]);
  }
  if (M.monkeyCount > 0) {
    rows.push([`${tt('mats.monkeyRungs')} (${M.monRungCount} ${tt('mats.pcs')})`, fm(M.monRungLen)]);
    if (M.monKee > 0) rows.push([tt('mats.monkeyKee'), `${M.monKee} ${tt('mats.pcs')}`]);
    if (M.monSwivel > 0) rows.push([tt('mats.monkeySwivel'), `${M.monSwivel} ${tt('mats.pcs')}`]);
  }
  rows.push([tt('mats.screws'), `~${32 + (M.ladRungCount + M.monRungCount) * 4} ${tt('mats.pcs')}`]);
  rows.push([tt('mats.gravel'), `${Math.round(M.gravelVol * 1000)} L`]);
  rows.push([tt('mats.filterFabric'), `${M.filterFabricCount} ${tt('mats.pcs')} · ~${fmt(M.filterFabricArea, 2, lang)} m²`]);
  rows.push([`${tt('mats.concrete')} (${tt('mats.bags')})`, `${fmt(M.concVol, 2, lang)} m³ (~${M.bags25})`]);
  rows.push([tt('mats.tar'), `~${fmt(M.tarLitre, 1, lang)} L`]);
  root.append(el('h2', {}, tt('mats.tableTitle')),
    el('table', { class: 'pr-tab' }, el('tbody', {}, ...rows.map(r =>
      el('tr', {}, el('td', {}, r[0]), el('td', { class: 'pr-q' }, r[1]))))));

  // ---- skæreliste (tekstform pr. materiale) ----
  root.append(el('h2', {}, tt('mats.cutTitle')));
  const kerfMm = Math.max(0.1, design.site.cutKerf_mm ?? KERF * 1000);
  const kerfM = kerfMm / 1000;
  for (const id of Object.keys(M.cut).sort()) {
    const grp = M.cut[id];
    const stockLen = (design.stock && design.stock[id]) || (grp.mat.kind === 'wood' ? 4.8 : STOCK);
    const { bars, count } = packPieces(grp.pieces, stockLen, kerfM);
    root.append(el('p', { class: 'pr-cut-h' }, `${matLabel(grp.mat, 'mm', lang)}: ${count} × ${fm(stockLen)} (${tt('mats.stockLen').toLowerCase()})`));
    const cutOverview = el('div', { class: 'pr-cut-overview' });
    const shades = segShades(grp.mat);
    bars.forEach((b, bi) => {
      const bar = el('div', { class: 'pr-cut-bar' });
      b.pieces.forEach((p, pi) => {
        bar.append(el('span', { class: 'pr-cut-seg', title: `${p.label}: ${fm(p.len)}`,
          style: `width:${Math.min(100, p.len / stockLen * 100).toFixed(2)}%;background:${shades[pi % shades.length]}` },
          el('b', {}, p.label), ` ${fmt(lenFromSI(p.len, su), 2, lang)}`));
        bar.append(el('span', { class: 'pr-cut-kerf', title: `${tt('mats.kerf')}: ${fmt(kerfMm, 1, lang)} mm`,
          style: `width:${Math.min(100, kerfM / stockLen * 100).toFixed(2)}%` }));
      });
      if (b.waste > 1e-6) bar.append(el('span', { class: 'pr-cut-waste', title: `${tt('mats.waste')} ${fm(b.waste)}`,
        style: `width:${Math.min(100, b.waste / stockLen * 100).toFixed(2)}%` }, `${tt('mats.waste')} ${fmt(lenFromSI(b.waste, su), 2, lang)}`));
      const list = b.pieces.map(p => `${p.label} ${fm(p.len)}`).join(' · ');
      cutOverview.append(el('div', { class: 'pr-cut-item' },
        el('span', { class: 'pr-cut-no' }, `#${bi + 1}`), bar,
        el('div', { class: 'pr-cut-list' }, `${list} · ${tt('mats.kerf')} ${fmt(kerfMm, 1, lang)} mm × ${b.pieces.length}${b.waste > 0.01 ? ` · ${tt('mats.waste')} ${fm(b.waste)}` : ''}`)));
    });
    root.append(cutOverview);
  }
  root.append(el('p', { class: 'pr-note' }, `${tt('mats.kerf')}: ${fmt(kerfMm, 1, lang)} mm — ${tt('mats.cutTotal3')} ${tt('mats.assume2')}`));

  // ---- støbe-trin ----
  root.append(el('h2', {}, tt('print.how')),
    el('ol', { class: 'pr-steps' }, ...[1, 2, 3, 4, 5, 6].map(n => el('li', {}, tt('print.step' + n)))));

  root.append(el('p', { class: 'pr-note' }, tt('disclaimer')));

  document.body.append(root);
  const printImg = root.querySelector('.pr-3d-img');
  if (printImg && printImg.decode) {
    try { await printImg.decode(); } catch (_) {}
  }
  const cleanup = () => { root.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
