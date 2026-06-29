// Fane: Kort (top-ned). Værktøjspalette, gitter m. snapping, pan/zoom,
// målestok, stolper, forbindelser (med bogstav + tykkelse=dimension + rød
// markering hvis spinkel) og stiger tegnet i deres rigtige størrelse.
// Tabel til højre viser alle forbindelser; klik for at vælge og ændre.

const W = 520, H = 440;
const MIN_K = 12, MAX_K = 400;

let tool = 'select';
let selectedPost = null;
let selectedConn = null;
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
    const selPanel = el('div', { class: 'selpanel' });
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

    function setHelp() { help.textContent = tt('site.help.' + tool); }

    function niceScale() {
      const ft = su === 'ft', toM = ft ? 0.3048 : 1;
      const cands = ft ? [1, 3, 6, 10, 20, 50] : [0.25, 0.5, 1, 2, 5, 10, 20];
      let best = cands[0];
      for (const c of cands) if (c * toM * view.k <= 150) best = c;
      return { meters: best * toM, label: `${fmt(best, best < 1 ? 2 : 0, lang)} ${ft ? tt('unit.ft') : tt('unit.m')}` };
    }

    function redraw() {
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
        conns += `<g pointer-events="none"><circle cx="${mx}" cy="${my}" r="8.5" fill="#fff" stroke="#94a3b0"/><text x="${mx}" y="${(+my + 3).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="#33414f">${letterFor(i)}</text></g>`;
      });

      // ---- stiger (tegnet i rigtig størrelse, peger ind mod centrum) ----
      const cxw = design.posts.reduce((s, p) => s + p.x_m, 0) / (design.posts.length || 1);
      const czw = design.posts.reduce((s, p) => s + p.z_m, 0) / (design.posts.length || 1);
      let ladders = '';
      for (const at of design.attachments) {
        if (at.type !== 'ladder') continue;
        const p = byId[at.postId]; if (!p) continue;
        const [sx, sy] = toScreen(p.x_m, p.z_m);
        let dx = cxw - p.x_m, dy = czw - p.z_m; const dl = Math.hypot(dx, dy);
        if (dl < 1e-6) { dx = 1; dy = 0; } else { dx /= dl; dy /= dl; }
        const L = Math.max(10, (at.width_m || 0.5) * view.k);
        const depth = Math.max(7, Math.min(L * 0.6, 0.3 * view.k));
        const ppx = -dy, ppy = dx;
        const ox = sx + dx * (side / 2), oy = sy + dy * (side / 2);
        const r1x = ox + ppx * depth / 2, r1y = oy + ppy * depth / 2;
        const r2x = ox - ppx * depth / 2, r2y = oy - ppy * depth / 2;
        let rungs = '';
        const nR = Math.max(2, Math.round(L / 14));
        for (let j = 1; j < nR; j++) { const t = j / nR; rungs += `<line x1="${(r1x + dx * L * t).toFixed(1)}" y1="${(r1y + dy * L * t).toFixed(1)}" x2="${(r2x + dx * L * t).toFixed(1)}" y2="${(r2y + dy * L * t).toFixed(1)}" stroke="#0e7490" stroke-width="1.5"/>`; }
        ladders += `<g data-el="ladder" data-id="${at.id}">
          <line x1="${r1x.toFixed(1)}" y1="${r1y.toFixed(1)}" x2="${(r1x + dx * L).toFixed(1)}" y2="${(r1y + dy * L).toFixed(1)}" stroke="#0e7490" stroke-width="2"/>
          <line x1="${r2x.toFixed(1)}" y1="${r2y.toFixed(1)}" x2="${(r2x + dx * L).toFixed(1)}" y2="${(r2y + dy * L).toFixed(1)}" stroke="#0e7490" stroke-width="2"/>
          ${rungs}
          <line x1="${ox.toFixed(1)}" y1="${oy.toFixed(1)}" x2="${(ox + dx * L).toFixed(1)}" y2="${(oy + dy * L).toFixed(1)}" stroke="#000" opacity="0" stroke-width="${(depth + 8).toFixed(1)}" pointer-events="all"/></g>`;
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

      mapBox.innerHTML =
        `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:100%">` +
        `<rect data-el="bg" x="0" y="0" width="${W}" height="${H}" fill="transparent"/>` +
        grid + conns + ladders + posts + empty + scale + `</svg>`;
    }

    // ---- højre panel: tabel over forbindelser + editor for valgt ----
    function infoRow(l, v) { return el('div', { class: 'res' }, el('span', { class: 'res-l' }, l), el('span', { class: 'res-v' }, v)); }
    function renderPanel() {
      clear(selPanel);
      const byId = byPost();
      const refLoad = design.site.refLoad_kg || 120;
      selPanel.append(el('h3', {}, tt('site.conn.tableTitle')));
      if (!design.connections.length) {
        selPanel.append(el('p', { class: 'sel-hint' }, tt('site.conn.empty')));
      } else {
        const head = el('tr', {}, el('th', {}, '#'), el('th', {}, tt('site.conn.th.mat')), el('th', {}, tt('site.connheight')), el('th', {}, tt('site.conn.th.load')));
        const rows = design.connections.map((c, i) => {
          const mat = connMat(c.material), span = spanOf(c, byId);
          const res = beam(Math.max(span, 0.05), mat, refLoad, 0.25);
          const crit = res.pYield < refLoad;
          return el('tr', { class: 'crow' + (c.id === selectedConn ? ' on' : '') + (crit ? ' crit' : ''),
            onclick: () => { selectedConn = c.id; selectedPost = null; redraw(); renderPanel(); } },
            el('td', {}, el('span', { class: 'cdot', style: `background:${colorOf(c.material)}` }), letterFor(i)),
            el('td', {}, mat.name),
            el('td', {}, fmt(lenFromSI(c.height_m, su), su === 'ft' ? 1 : 1, lang)),
            el('td', {}, `${Math.round(res.pYield)}${crit ? ' ⚠' : ''}`));
        });
        selPanel.append(el('table', { class: 'conntab' }, head, ...rows));
      }
      selPanel.append(el('p', { class: 'encnote' }, tt('site.conn.encoding')));

      const c = design.connections.find(x => x.id === selectedConn);
      if (c) {
        const byId2 = byPost(), span = spanOf(c, byId2), mat = connMat(c.material);
        const refL = design.site.refLoad_kg || 120;
        const res = beam(Math.max(span, 0.05), mat, refL, 0.25);
        const crit = res.pYield < refL;
        selPanel.append(el('div', { class: 'conneditor' },
          el('h3', {}, `${tt('site.conn.title')} ${letterFor(design.connections.indexOf(c))}`),
          el('label', { class: 'fld' }, el('span', { class: 'fld-l' }, tt('mat.title')),
            select(design.library.map(m => [m.id, m.name]), mat.id,
              v => { store.update(d => { d.connections.find(x => x.id === c.id).material = { source: 'library', id: v }; }); redraw(); renderPanel(); })),
          el('label', { class: 'fld' }, el('span', { class: 'fld-l' }, `${tt('site.connheight')} (${suTxt})`),
            lenInput(c.height_m, su, v => { store.update(d => { d.connections.find(x => x.id === c.id).height_m = v; }); })),
          el('div', { class: 'sel-info' },
            infoRow(tt('site.conn.span'), `${fmt(lenFromSI(span, su), 2, lang)} ${suTxt}`),
            infoRow(`${tt('site.conn.deflection')} ${Math.round(refL)} kg`, fmtDispl(res.dReal * 1000, 'mm', lang)),
            infoRow(tt('bar.res.yield'), fmtMass(res.pYield, 'kg', lang)),
            infoRow(tt('bar.res.ultimate'), fmtMass(res.pUlt, 'kg', lang))),
          crit ? el('div', { class: 'crit' }, tt('site.conn.critical')) : null));
      }
    }

    // ---- interaktion (husk klik-mål ved pointerdown — robust mod pan-capture) ----
    let drag = null, down = null;
    mapBox.addEventListener('pointerdown', e => {
      const [ux, uy] = evtToUser(e);
      const t = e.target.closest('[data-el]');
      down = { kind: t && t.getAttribute('data-el'), id: t && t.getAttribute('data-id'), ux, uy };
      if (tool === 'select' && down.kind === 'post') { drag = { mode: 'move', id: down.id, sux: ux, suy: uy, moved: false }; try { mapBox.setPointerCapture(e.pointerId); } catch (_) {} }
      else if (tool === 'select') { drag = { mode: 'pan', sux: ux, suy: uy, stx: view.tx, sty: view.ty, moved: false }; try { mapBox.setPointerCapture(e.pointerId); } catch (_) {} }
    });
    mapBox.addEventListener('pointermove', e => {
      if (!drag) return;
      const [ux, uy] = evtToUser(e);
      if (Math.hypot(ux - drag.sux, uy - drag.suy) > 3) drag.moved = true;
      if (drag.mode === 'pan') { view.tx = drag.stx + (ux - drag.sux); view.ty = drag.sty + (uy - drag.suy); redraw(); }
      else if (drag.mode === 'move') { const p = design.posts.find(x => x.id === drag.id); if (!p) return; const [wx, wz] = toWorld(ux, uy); p.x_m = snap(wx); p.z_m = snap(wz); redraw(); renderPanel(); }
    });
    mapBox.addEventListener('pointerup', () => {
      const wasDrag = drag && drag.moved;
      if (drag && drag.mode === 'move' && drag.moved) store.commit();
      drag = null;
      if (!wasDrag && down) handleClick(down.kind, down.id, down.ux, down.uy);
      down = null;
    });

    function handleClick(kind, id, ux, uy) {
      if (tool === 'post' && (kind === 'bg' || !kind)) {
        const [wx, wz] = toWorld(ux, uy);
        store.update(d => d.posts.push({ id: nextId(d.posts, 'p'), x_m: snap(wx), z_m: snap(wz), override: null }));
        redraw();
      } else if (tool === 'select') {
        selectedPost = kind === 'post' ? id : null;
        selectedConn = kind === 'conn' ? id : null;
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
          onclick: () => { tool = id; connectFrom = null; selectedPost = null; selectedConn = null; setHelp();
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
      el('div', { class: 'map-wrap' }, palette, mapBox, selPanel),
      help);
  },
};

function nextId(list, prefix) {
  let n = 0;
  for (const it of list) { const m = /(\d+)$/.exec(it.id || ''); if (m) n = Math.max(n, +m[1]); }
  return prefix + (n + 1);
}
