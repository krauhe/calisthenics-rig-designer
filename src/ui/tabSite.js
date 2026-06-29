// Fane: Kort (top-ned). Værktøjspalette, gitter m. snapping, pan/zoom,
// målestok, stolper, forbindelser (med bogstav + tykkelse=dimension + rød
// markering hvis spinkel) og stiger tegnet i deres rigtige størrelse.
// Tabel til højre viser alle forbindelser; klik for at vælge og ændre.

const W = 520, H = 440;
const MIN_K = 12, MAX_K = 400;

let tool = 'select';
let selectedPost = null;
let selectedConn = null;
let selectedLadder = null;
let connectFrom = null;
let view = null;

const TOOLS = [
  ['select', '🖱', 'tool.select'],
  ['post', '▪', 'tool.post'],
  ['connect', '／', 'tool.connect'],
  ['ladder', '🪜', 'tool.ladder'],
  ['delete', '🗑', 'tool.delete'],
];

function letterFor(i) { return i < 26 ? String.fromCharCode(65 + i) : '#' + (i + 1); }

const tabSite = {
  id: 'site',
  labelKey: 'tab.site',
  render(container, ctx) {
    const { design, store, lang } = ctx;
    const tt = k => ctx.t(k, lang);
    if (!view) view = { k: 70, tx: W / 2, ty: H * 0.6 };
    const su = (design.units.site && design.units.site.len) || 'm';
    const suTxt = su === 'ft' ? tt('unit.ft') : tt('unit.m');

    const mapBox = el('div', { class: 'map' });
    const selPanel = el('div', { class: 'conntable-area' });
    const help = el('div', { class: 'map-help' });

    const toScreen = (wx, wz) => [wx * view.k + view.tx, wz * view.k + view.ty];
    const toWorld = (sx, sy) => [(sx - view.tx) / view.k, (sy - view.ty) / view.k];
    const snap = w => { const g = design.site.grid_m || 0.125; return Math.round(w / g) * g; };
    const evtToUser = e => {
      const r = mapBox.getBoundingClientRect();
      return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)];
    };
    const postSideM = () => { const m = resolveMaterial(design, design.defaults.post.materialId); return (m.kind === 'wood' ? m.side : m.od) / 1000; };
    const connMat = ref => { const id = ref && ref.source === 'library' ? ref.id : ref; return design.library.find(m => m.id === id) || design.library[0]; };
    const colorOf = ref => { const i = design.library.findIndex(m => m.id === (ref && ref.id)); return COLORS[(i < 0 ? 0 : i) % COLORS.length]; };
    const byPost = () => Object.fromEntries(design.posts.map(p => [p.id, p]));
    const spanOf = (c, byId) => { const a = byId[c.a], b = byId[c.b]; return (a && b) ? Math.hypot(b.x_m - a.x_m, b.z_m - a.z_m) : 0; };
    const nearestPost = (wx, wz) => { let best = null, bd = Infinity; for (const p of design.posts) { const d = Math.hypot(p.x_m - wx, p.z_m - wz); if (d < bd) { bd = d; best = p; } } return best; };
    // Find en akse-justering med en anden stolpe (samme x eller z) inden for en
    // skærm-tolerance. Returnerer den fælles koordinat (eller null) pr. akse.
    const alignSnap = (wx, wz, excludeId) => {
      const tol = 9 / view.k;
      let ax = null, az = null, bx = tol, bz = tol;
      for (const p of design.posts) {
        if (p.id === excludeId) continue;
        const dx = Math.abs(p.x_m - wx); if (dx < bx) { bx = dx; ax = p.x_m; }
        const dz = Math.abs(p.z_m - wz); if (dz < bz) { bz = dz; az = p.z_m; }
      }
      return { x: ax, z: az };
    };
    // Hvilken vandret bar binder stigen sig til? Den forbindelse på stolpen, hvis
    // retning passer bedst til stigens vinkel (ellers den højeste).
    const ladderBar = (at, byId) => {
      const conns = design.connections.filter(c => c.a === at.postId || c.b === at.postId);
      const p = byId[at.postId]; if (!conns.length || !p) return null;
      const dirTo = c => { const o = byId[c.a === at.postId ? c.b : c.a]; return Math.atan2(o.z_m - p.z_m, o.x_m - p.x_m); };
      let best = conns[0];
      if (at.angle_rad == null) { for (const c of conns) if (c.height_m > best.height_m) best = c; }
      else {
        let bd = Infinity;
        for (const c of conns) { const d = dirTo(c); let diff = Math.abs(((d - at.angle_rad + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI); if (diff < bd) { bd = diff; best = c; } }
      }
      const a = dirTo(best);
      return { conn: best, dx: Math.cos(a), dy: Math.sin(a) };
    };

    function setHelp() { help.textContent = tt('site.help.' + tool); }

    function niceScale() {
      // Fast målestok: 1 m (metrisk) ≈ 3 fod (imperial).
      if (su === 'ft') return { meters: 3 * 0.3048, label: `3 ${tt('unit.ft')}` };
      return { meters: 1, label: `1 ${tt('unit.m')}` };
    }

    function redraw(live) {
      const g = design.site.grid_m || 0.125;
      const refLoad = design.site.refLoad_kg || 120;
      const [minWx, minWz] = toWorld(0, 0), [maxWx, maxWz] = toWorld(W, H);
      let step = g; while (step * view.k < 7) step *= 2;

      let grid = '';
      for (let x = Math.ceil(minWx / step) * step; x <= maxWx; x += step) {
        const [sx] = toScreen(x, 0); const axis = Math.abs(x) < 1e-9;
        grid += `<line x1="${sx.toFixed(1)}" y1="0" x2="${sx.toFixed(1)}" y2="${H}" stroke="${axis ? '#b7c2cd' : '#e7ecf1'}" stroke-width="${axis ? 1.2 : 1}"/>`;
      }
      for (let z = Math.ceil(minWz / step) * step; z <= maxWz; z += step) {
        const [, sy] = toScreen(0, z); const axis = Math.abs(z) < 1e-9;
        grid += `<line x1="0" y1="${sy.toFixed(1)}" x2="${W}" y2="${sy.toFixed(1)}" stroke="${axis ? '#b7c2cd' : '#e7ecf1'}" stroke-width="${axis ? 1.2 : 1}"/>`;
      }

      const byId = byPost();
      const side = Math.max(7, postSideM() * view.k);

      let conns = '';
      design.connections.forEach((c, i) => {
        const a = byId[c.a], b = byId[c.b]; if (!a || !b) return;
        const [ax, ay] = toScreen(a.x_m, a.z_m), [bx, by] = toScreen(b.x_m, b.z_m);
        const mat = connMat(c.material);
        const dimMm = mat.kind === 'wood' ? mat.side : mat.od;
        const sw = Math.max(2, Math.min(11, dimMm / 12));
        const span = Math.hypot(b.x_m - a.x_m, b.z_m - a.z_m);
        const critical = span > 0 && beam(span, mat, 1, 0.25).pYield < refLoad;
        const X1 = ax.toFixed(1), Y1 = ay.toFixed(1), X2 = bx.toFixed(1), Y2 = by.toFixed(1);
        const mx = ((ax + bx) / 2).toFixed(1), my = ((ay + by) / 2).toFixed(1);
        if (c.id === selectedConn) conns += `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="#0b66c3" stroke-width="${sw + 6}" stroke-linecap="round" opacity="0.35"/>`;
        if (critical) conns += `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="#e11d1d" stroke-width="${sw + 5}" stroke-linecap="round" opacity="0.5"/>`;
        conns += `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="${colorOf(c.material)}" stroke-width="${sw}" stroke-linecap="round"/>`;
        conns += `<line data-el="conn" data-id="${c.id}" x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="#000" opacity="0" stroke-width="14" stroke-linecap="round" pointer-events="all"/>`;
        if (!live) conns += `<g pointer-events="none"><circle cx="${mx}" cy="${my}" r="8.5" fill="#fff" stroke="#94a3b0"/><text x="${mx}" y="${(+my + 3).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="#33414f">${letterFor(i)}</text></g>`;
      });

      // ---- stiger: lodret stige der binder sig til en vandret bar (som i 3D).
      // Plan-symbol: en stige langs baren, fra stolpen og 'stigebredde' ud. ----
      const cxw = design.posts.reduce((s, p) => s + p.x_m, 0) / (design.posts.length || 1);
      const czw = design.posts.reduce((s, p) => s + p.z_m, 0) / (design.posts.length || 1);
      let ladders = '';
      for (const at of design.attachments) {
        if (at.type !== 'ladder') continue;
        const p = byId[at.postId]; if (!p) continue;
        const [sx, sy] = toScreen(p.x_m, p.z_m);
        const bar = ladderBar(at, byId);
        let dx, dy;
        if (bar) { dx = bar.dx; dy = bar.dy; }
        else { dx = p.x_m - cxw; dy = p.z_m - czw; const dl = Math.hypot(dx, dy); if (dl < 1e-6) { dx = 0; dy = 1; } else { dx /= dl; dy /= dl; } }
        const L = Math.max(12, (at.width_m || 0.5) * view.k);     // afstand stolpe→lodret rør
        const wHalf = Math.max(5, 0.085 * view.k);                // symbolbredde (kosmetisk)
        const ppx = -dy, ppy = dx;
        const ox = sx + dx * (side / 2), oy = sy + dy * (side / 2);
        const ex = ox + dx * L, ey = oy + dy * L;                 // det lodrette rør (pole)
        const r1x = ox + ppx * wHalf, r1y = oy + ppy * wHalf, r1ex = ex + ppx * wHalf, r1ey = ey + ppy * wHalf;
        const r2x = ox - ppx * wHalf, r2y = oy - ppy * wHalf, r2ex = ex - ppx * wHalf, r2ey = ey - ppy * wHalf;
        let rungs = '';
        const nR = Math.max(2, Math.round(L / 12));
        for (let j = 0; j <= nR; j++) { const t = j / nR; rungs += `<line x1="${(r1x + (r1ex - r1x) * t).toFixed(1)}" y1="${(r1y + (r1ey - r1y) * t).toFixed(1)}" x2="${(r2x + (r2ex - r2x) * t).toFixed(1)}" y2="${(r2y + (r2ey - r2y) * t).toFixed(1)}" stroke="#0e7490" stroke-width="1.4"/>`; }
        const selL = at.id === selectedLadder ? `<line x1="${ox.toFixed(1)}" y1="${oy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#0b66c3" stroke-width="${(wHalf * 2 + 8).toFixed(1)}" stroke-linecap="round" opacity="0.25"/>` : '';
        ladders += `<g data-el="ladder" data-id="${at.id}">${selL}
          <line x1="${r1x.toFixed(1)}" y1="${r1y.toFixed(1)}" x2="${r1ex.toFixed(1)}" y2="${r1ey.toFixed(1)}" stroke="#0e7490" stroke-width="2"/>
          <line x1="${r2x.toFixed(1)}" y1="${r2y.toFixed(1)}" x2="${r2ex.toFixed(1)}" y2="${r2ey.toFixed(1)}" stroke="#0e7490" stroke-width="2"/>
          ${rungs}
          <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="3.4" fill="#0e7490"/>
          <line x1="${ox.toFixed(1)}" y1="${oy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#000" opacity="0" stroke-width="${(wHalf * 2 + 8).toFixed(1)}" pointer-events="all"/></g>`;
      }

      let posts = '';
      for (const p of design.posts) {
        const [sx, sy] = toScreen(p.x_m, p.z_m);
        const sel = p.id === selectedPost || p.id === connectFrom;
        posts += `<rect data-el="post" data-id="${p.id}" x="${(sx - side / 2).toFixed(1)}" y="${(sy - side / 2).toFixed(1)}" width="${side.toFixed(1)}" height="${side.toFixed(1)}" rx="2" fill="#b6986a" stroke="${sel ? '#0b66c3' : '#6b4f2a'}" stroke-width="${sel ? 2.5 : 1.2}"/>`;
      }

      const empty = design.posts.length === 0
        ? `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="13" fill="#9aa6b2">${tt('site.empty')}</text>` : '';

      // ---- målestok (fast overlay) ----
      const sc = niceScale(); const spx = sc.meters * view.k;
      const sbx = 14, sby = H - 14;
      const scale = `<g pointer-events="none">
        <rect x="${sbx - 6}" y="${(sby - 20).toFixed(1)}" width="${(spx + 12).toFixed(1)}" height="28" fill="#ffffff" opacity="0.78" rx="4"/>
        <line x1="${sbx}" y1="${sby}" x2="${(sbx + spx).toFixed(1)}" y2="${sby}" stroke="#33414f" stroke-width="2.5"/>
        <line x1="${sbx}" y1="${sby - 5}" x2="${sbx}" y2="${sby + 5}" stroke="#33414f" stroke-width="2.5"/>
        <line x1="${(sbx + spx).toFixed(1)}" y1="${sby - 5}" x2="${(sbx + spx).toFixed(1)}" y2="${sby + 5}" stroke="#33414f" stroke-width="2.5"/>
        <text x="${(sbx + spx / 2).toFixed(1)}" y="${sby - 7}" text-anchor="middle" font-size="11" font-weight="600" fill="#33414f">${sc.label}</text></g>`;

      // ---- justerings-hjælpelinjer (stiplet) + spøgelses-stolpe ----
      let guideSvg = '';
      if (guides) {
        if (guides.x != null) { const [gx] = toScreen(guides.x, 0); guideSvg += `<line x1="${gx.toFixed(1)}" y1="0" x2="${gx.toFixed(1)}" y2="${H}" stroke="#0b66c3" stroke-width="1" stroke-dasharray="5 4" opacity="0.75"/>`; }
        if (guides.z != null) { const [, gy] = toScreen(0, guides.z); guideSvg += `<line x1="0" y1="${gy.toFixed(1)}" x2="${W}" y2="${gy.toFixed(1)}" stroke="#0b66c3" stroke-width="1" stroke-dasharray="5 4" opacity="0.75"/>`; }
        if (guides.ghost) { const [gx, gy] = toScreen(guides.ghost.x, guides.ghost.z); guideSvg += `<rect x="${(gx - side / 2).toFixed(1)}" y="${(gy - side / 2).toFixed(1)}" width="${side.toFixed(1)}" height="${side.toFixed(1)}" rx="2" fill="#b6986a" fill-opacity="0.35" stroke="#0b66c3" stroke-width="1.4" stroke-dasharray="4 3"/>`; }
      }

      mapBox.innerHTML =
        `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:100%">` +
        `<rect data-el="bg" x="0" y="0" width="${W}" height="${H}" fill="transparent"/>` +
        grid + conns + ladders + posts + guideSvg + empty + scale + `</svg>`;
    }

    // ---- forbindelses-tabel: ALLE parametre, redigerbare direkte i tabellen ----
    // Materiale (rør-dim), højde og længde er redigerbare input; sikker last,
    // brudlast og nedbøjning beregnes og vises.
    function setSpan(c, newLenSI) {
      if (!(newLenSI > 0)) return;
      store.update(d => {
        const a = d.posts.find(p => p.id === c.a), b = d.posts.find(p => p.id === c.b);
        if (!a || !b) return;
        let ux = b.x_m - a.x_m, uz = b.z_m - a.z_m; const len = Math.hypot(ux, uz);
        if (len < 1e-6) { ux = 1; uz = 0; } else { ux /= len; uz /= len; }
        b.x_m = a.x_m + ux * newLenSI; b.z_m = a.z_m + uz * newLenSI;
      });
    }
    function renderPanel() {
      clear(selPanel);
      const refLoad = design.site.refLoad_kg || 120;
      selPanel.append(el('h3', {}, tt('site.conn.tableTitle')));
      if (!design.connections.length) {
        selPanel.append(el('p', { class: 'sel-hint' }, tt('site.conn.empty')));
        selPanel.append(el('p', { class: 'encnote' }, tt('site.conn.encoding')));
        return;
      }
      const byId = byPost();
      const head = el('tr', {},
        el('th', {}, '#'),
        el('th', {}, tt('site.conn.th.mat')),
        el('th', {}, `${tt('site.conn.th.height')} (${suTxt})`),
        el('th', {}, `${tt('site.conn.span')} (${suTxt})`),
        el('th', {}, `${tt('bar.res.yield')} (kg)`),
        el('th', {}, `${tt('bar.res.ultimate')} (kg)`),
        el('th', {}, `${tt('site.conn.deflection')} ${Math.round(refLoad)} kg`));
      const rows = design.connections.map((c, i) => {
        const mat = connMat(c.material), span = spanOf(c, byId);
        const res = () => beam(Math.max(spanOf(c, byPost()), 0.05), connMat(c.material), refLoad, 0.25);
        const safeCell = el('td', { class: 'numc' }, '');
        const ultCell = el('td', { class: 'numc' }, '');
        const deflCell = el('td', { class: 'numc' }, '');
        const tr = el('tr', {});
        const paint = () => {
          const r = res();
          const crit = r.pYield < refLoad;
          clear(safeCell); safeCell.append(`${Math.round(r.pYield)}${crit ? ' ⚠' : ''}`);
          clear(ultCell); ultCell.append(`${Math.round(r.pUlt)}`);
          clear(deflCell); deflCell.append(fmtDispl(r.dReal * 1000, 'mm', lang));
          tr.className = 'crow' + (c.id === selectedConn ? ' on' : '') + (crit ? ' crit' : '');
        };
        const matSel = select(design.library.map(m => [m.id, m.name]), mat.id, v => {
          store.update(d => { d.connections.find(x => x.id === c.id).material = { source: 'library', id: v }; });
          redraw(); renderPanel();
        });
        const hInp = lenInput(c.height_m, su, v => { store.update(d => { d.connections.find(x => x.id === c.id).height_m = v; }); redraw(); });
        const lInp = el('input', { type: 'number', step: su === 'ft' ? '0.1' : '0.05', value: String(round(lenFromSI(span, su))) });
        lInp.addEventListener('input', () => { const v = parseFloat(lInp.value); if (!isNaN(v) && v > 0) { setSpan(c, lenToSI(v, su)); redraw(); paint(); } });
        lInp.addEventListener('change', () => { redraw(); renderPanel(); });
        const stop = e => e.stopPropagation();
        [matSel, hInp, lInp].forEach(x => x.addEventListener('pointerdown', stop));
        tr.addEventListener('click', e => { if (e.target.closest('select,input')) return; selectedConn = c.id; selectedPost = null; selectedLadder = null; redraw(); renderPanel(); });
        tr.append(
          el('td', {}, el('span', { class: 'cdot', style: `background:${colorOf(c.material)}` }), letterFor(i)),
          el('td', { class: 'editc' }, matSel),
          el('td', { class: 'editc' }, hInp),
          el('td', { class: 'editc' }, lInp),
          safeCell, ultCell, deflCell);
        paint();
        return tr;
      });
      selPanel.append(el('table', { class: 'conntab full' }, el('thead', {}, head), el('tbody', {}, ...rows)));
      selPanel.append(el('p', { class: 'encnote' }, tt('site.conn.encoding')));
    }

    // ---- interaktion (husk klik-mål ved pointerdown — robust mod pan-capture) ----
    let drag = null, down = null, guides = null;
    mapBox.addEventListener('pointerdown', e => {
      const [ux, uy] = evtToUser(e);
      const t = e.target.closest('[data-el]');
      down = { kind: t && t.getAttribute('data-el'), id: t && t.getAttribute('data-id'), ux, uy };
      if (tool === 'select' && down.kind === 'post') { drag = { mode: 'move', id: down.id, sux: ux, suy: uy, moved: false }; try { mapBox.setPointerCapture(e.pointerId); } catch (_) {} }
      else if (tool === 'select' && down.kind === 'ladder') { drag = { mode: 'ladder', id: down.id, sux: ux, suy: uy, moved: false }; try { mapBox.setPointerCapture(e.pointerId); } catch (_) {} }
      else if (tool === 'select') { drag = { mode: 'pan', sux: ux, suy: uy, stx: view.tx, sty: view.ty, moved: false }; try { mapBox.setPointerCapture(e.pointerId); } catch (_) {} }
    });
    mapBox.addEventListener('pointermove', e => {
      if (!drag) {
        // forhåndsvisning + justeringslinjer når man placerer en stolpe
        if (tool === 'post') {
          const [ux, uy] = evtToUser(e);
          const [wx, wz] = toWorld(ux, uy);
          const al = alignSnap(wx, wz, null);
          guides = { x: al.x, z: al.z, ghost: { x: al.x != null ? al.x : snap(wx), z: al.z != null ? al.z : snap(wz) } };
          redraw();
        } else if (guides) { guides = null; redraw(); }
        return;
      }
      const [ux, uy] = evtToUser(e);
      if (Math.hypot(ux - drag.sux, uy - drag.suy) > 3) drag.moved = true;
      if (drag.mode === 'pan') { view.tx = drag.stx + (ux - drag.sux); view.ty = drag.sty + (uy - drag.suy); redraw(true); }
      else if (drag.mode === 'move') {
        const p = design.posts.find(x => x.id === drag.id); if (!p) return;
        const [wx, wz] = toWorld(ux, uy);
        const al = alignSnap(wx, wz, p.id);
        p.x_m = al.x != null ? al.x : snap(wx);
        p.z_m = al.z != null ? al.z : snap(wz);
        guides = { x: al.x, z: al.z, ghost: null };
        redraw(true);
      }
      else if (drag.mode === 'ladder') {
        const at = design.attachments.find(a => a.id === drag.id); if (!at) return;
        const [wx, wz] = toWorld(ux, uy);
        const np = nearestPost(wx, wz); if (np) at.postId = np.id;
        const pp = design.posts.find(x => x.id === at.postId) || np;
        if (pp) at.angle_rad = Math.atan2(wz - pp.z_m, wx - pp.x_m);
        redraw(true);
      }
    });
    mapBox.addEventListener('pointerup', () => {
      const wasDrag = drag && drag.moved;
      const mode = drag && drag.mode;
      if (wasDrag && (mode === 'move' || mode === 'ladder')) store.commit();
      drag = null; guides = null;
      if (wasDrag) redraw();                              // gentegn med bogstav-labels igen
      if (wasDrag && (mode === 'move' || mode === 'ladder')) renderPanel();
      if (!wasDrag && down) handleClick(down.kind, down.id, down.ux, down.uy);
      down = null;
    });
    mapBox.addEventListener('pointerleave', () => { if (!drag && guides) { guides = null; redraw(); } });

    function handleClick(kind, id, ux, uy) {
      if (tool === 'post' && (kind === 'bg' || !kind)) {
        const [wx, wz] = toWorld(ux, uy);
        const al = alignSnap(wx, wz, null);
        const fx = al.x != null ? al.x : snap(wx), fz = al.z != null ? al.z : snap(wz);
        store.update(d => d.posts.push({ id: nextId(d.posts, 'p'), x_m: fx, z_m: fz, override: null }));
        guides = null; redraw();
      } else if (tool === 'select') {
        selectedPost = kind === 'post' ? id : null;
        selectedConn = kind === 'conn' ? id : null;
        selectedLadder = kind === 'ladder' ? id : null;
        redraw(); renderPanel();
      } else if (tool === 'connect' && kind === 'post') {
        if (!connectFrom) { connectFrom = id; }
        else if (connectFrom !== id) {
          const a = connectFrom, b = id;
          const exists = design.connections.some(c => (c.a === a && c.b === b) || (c.a === b && c.b === a));
          if (!exists) store.update(d => d.connections.push({ id: nextId(d.connections, 'c'), a, b, height_m: d.site.connHeight_m, material: { source: 'library', id: d.site.connMaterialId }, onTop: false }));
          connectFrom = null;
        }
        redraw(); renderPanel();
      } else if (tool === 'ladder' && kind === 'post') {
        store.update(d => d.attachments.push({ id: nextId(d.attachments, 'a'), type: 'ladder', postId: id, width_m: d.site.ladderWidth_m }));
        redraw();
      } else if (tool === 'delete') {
        if (kind === 'post') store.update(d => { d.posts = d.posts.filter(p => p.id !== id); d.connections = d.connections.filter(c => c.a !== id && c.b !== id); d.attachments = d.attachments.filter(at => at.postId !== id); });
        else if (kind === 'conn') store.update(d => { d.connections = d.connections.filter(c => c.id !== id); d.attachments = d.attachments.filter(at => at.connectionId !== id); });
        else if (kind === 'ladder') store.update(d => { d.attachments = d.attachments.filter(at => at.id !== id); });
        if (selectedPost && !design.posts.some(p => p.id === selectedPost)) selectedPost = null;
        if (selectedConn && !design.connections.some(c => c.id === selectedConn)) selectedConn = null;
        if (selectedLadder && !design.attachments.some(a => a.id === selectedLadder)) selectedLadder = null;
        redraw(); renderPanel();
      }
    }

    mapBox.addEventListener('wheel', e => {
      e.preventDefault();
      const [ux, uy] = evtToUser(e);
      const [wx, wz] = toWorld(ux, uy);
      view.k = Math.min(MAX_K, Math.max(MIN_K, view.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      view.tx = ux - wx * view.k; view.ty = uy - wz * view.k;
      redraw();
    }, { passive: false });

    function fit() {
      if (!design.posts.length) { view = { k: 70, tx: W / 2, ty: H * 0.6 }; redraw(); return; }
      const xs = design.posts.map(p => p.x_m), zs = design.posts.map(p => p.z_m);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const pad = 0.6;
      const k = Math.min(MAX_K, Math.max(MIN_K, Math.min(W / (maxX - minX + 2 * pad || 1), H / (maxZ - minZ + 2 * pad || 1))));
      view = { k, tx: W / 2 - (minX + maxX) / 2 * k, ty: H / 2 - (minZ + maxZ) / 2 * k };
      redraw();
    }

    const palette = el('div', { class: 'toolpalette' },
      ...TOOLS.map(([id, icon, key]) =>
        el('button', { class: 'toolbtn' + (tool === id ? ' on' : ''), type: 'button', title: tt(key), 'data-tool': id,
          onclick: () => { tool = id; connectFrom = null; selectedPost = null; selectedConn = null; selectedLadder = null; guides = null; setHelp();
            palette.querySelectorAll('.toolbtn').forEach(b => b.classList.toggle('on', b.getAttribute('data-tool') === id));
            redraw(); renderPanel(); } },
          el('span', { class: 'toolbtn-i' }, icon), el('span', { class: 'toolbtn-t' }, tt(key)))),
      el('div', { class: 'zoombar' },
        el('button', { class: 'btn-sm', type: 'button', title: 'zoom +', onclick: () => zoom(1.2) }, '＋'),
        el('button', { class: 'btn-sm', type: 'button', title: 'zoom −', onclick: () => zoom(1 / 1.2) }, '−'),
        el('button', { class: 'btn-sm', type: 'button', title: tt('site.fit'), onclick: fit }, '⌖')));

    function zoom(f) { view.k = Math.min(MAX_K, Math.max(MIN_K, view.k * f)); redraw(); }

    const gridCm = Math.round((design.site.grid_m || 0.125) * 1000) / 10;
    const gridInp = el('input', { type: 'number', step: '0.5', min: '1', value: String(gridCm), style: 'width:70px' });
    gridInp.addEventListener('input', () => { const v = parseFloat(gridInp.value); if (v > 0) { store.update(d => { d.site.grid_m = v / 100; }); redraw(); } });
    const presets = el('div', { class: 'gridpresets' },
      ...[5, 10, 12.5, 25, 50].map(cm =>
        el('button', { class: 'btn-sm', type: 'button', onclick: () => { gridInp.value = String(cm); store.update(d => { d.site.grid_m = cm / 100; }); redraw(); } }, cm + '')));

    const settings = el('div', { class: 'site-settings' },
      unitToggle(tt('units.length'), [['m', tt('unit.m')], ['ft', tt('unit.ft')]], su,
        v => { store.update(d => { d.units.site.len = v; }); ctx.rerender(); }),
      el('label', { class: 'fld inline' }, el('span', { class: 'fld-l' }, `${tt('site.grid')} (cm)`), gridInp, presets),
      el('label', { class: 'fld inline' }, el('span', { class: 'fld-l' }, tt('site.connmat')),
        select(design.library.map(m => [m.id, m.name]), design.site.connMaterialId,
          v => { store.update(d => { d.site.connMaterialId = v; }); redraw(); })),
      el('label', { class: 'fld inline' }, el('span', { class: 'fld-l' }, `${tt('site.connheight')} (${suTxt})`),
        lenInput(design.site.connHeight_m, su, v => store.update(d => { d.site.connHeight_m = v; }))),
      el('label', { class: 'fld inline' }, el('span', { class: 'fld-l' }, `${tt('site.ladderwidth')} (${suTxt})`),
        lenInput(design.site.ladderWidth_m, su, v => { store.update(d => { d.site.ladderWidth_m = v; }); redraw(); })),
      el('label', { class: 'fld inline', title: tt('site.refload.hint') }, el('span', { class: 'fld-l' }, `${tt('site.refload')} (kg)`),
        numInput(design.site.refLoad_kg || 120, 5, v => { store.update(d => { d.site.refLoad_kg = v; }); redraw(); renderPanel(); })));

    setHelp();
    redraw();
    renderPanel();
    container.append(
      el('h2', {}, tt('tab.site')),
      el('p', { class: 'intro' }, tt('site.intro')),
      settings,
      el('div', { class: 'map-wrap' }, palette, mapBox),
      help,
      selPanel);
  },
};

function nextId(list, prefix) {
  let n = 0;
  for (const it of list) { const m = /(\d+)$/.exec(it.id || ''); if (m) n = Math.max(n, +m[1]); }
  return prefix + (n + 1);
}
