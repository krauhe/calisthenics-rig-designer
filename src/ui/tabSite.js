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
let selectedAvatar = null;
let connectFrom = null;
let view = null;

const TOOLS = [
  ['select', '🖱', 'tool.select'],
  ['post', '▪', 'tool.post'],
  ['connect', '／', 'tool.connect'],
  ['ladder', '🪜', 'tool.ladder'],
  ['avatar', '🧍', 'tool.avatar'],
  ['delete', '🗑', 'tool.delete'],
];

function letterFor(i) { return i < 26 ? String.fromCharCode(65 + i) : '#' + (i + 1); }

// Knap-ikon der matcher musecursoren for hvert værktøj (lille inline-SVG).
function toolIcon(t) {
  const w = b => `<svg width='18' height='18' viewBox='0 0 28 28' xmlns='http://www.w3.org/2000/svg'>${b}</svg>`;
  if (t === 'select') return w(`<path d='M10 13V7.4a1.6 1.6 0 0 1 3.2 0V12 M13.2 12V5.8a1.6 1.6 0 0 1 3.2 0V12 M16.4 12V6.6a1.6 1.6 0 0 1 3.2 0V13 M19.6 13V9a1.6 1.6 0 0 1 3.2 0v6.4c0 4-2.6 7-6.7 7h-1.1c-2 0-3.4-.8-4.7-2.4L6 17.6a1.7 1.7 0 0 1 2.7-2L10 17' fill='none' stroke='#c2cdd8' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/>`);
  if (t === 'post') return w(`<line x1='14' y1='3' x2='14' y2='25' stroke='#0b66c3' stroke-width='1.4'/><line x1='3' y1='14' x2='25' y2='14' stroke='#0b66c3' stroke-width='1.4'/><rect x='9' y='9' width='10' height='10' rx='2' fill='#b6986a' stroke='#6b4f2a' stroke-width='1.3'/>`);
  if (t === 'connect') return w(`<line x1='14' y1='14' x2='6' y2='22' stroke='#0b66c3' stroke-width='1.6'/><line x1='14' y1='14' x2='22' y2='6' stroke='#0b66c3' stroke-width='1.6'/><circle cx='6' cy='22' r='2.6' fill='#fff' stroke='#0b66c3' stroke-width='1.4'/><circle cx='22' cy='6' r='2.6' fill='#fff' stroke='#0b66c3' stroke-width='1.4'/><circle cx='14' cy='14' r='2.6' fill='#0b66c3'/>`);
  if (t === 'ladder') return w(`<line x1='10' y1='3' x2='10' y2='25' stroke='#0e7490' stroke-width='2'/><line x1='18' y1='3' x2='18' y2='25' stroke='#0e7490' stroke-width='2'/><line x1='10' y1='8' x2='18' y2='8' stroke='#0e7490' stroke-width='1.8'/><line x1='10' y1='14' x2='18' y2='14' stroke='#0e7490' stroke-width='1.8'/><line x1='10' y1='20' x2='18' y2='20' stroke='#0e7490' stroke-width='1.8'/>`);
  if (t === 'avatar') return w(`<circle cx='14' cy='6' r='3' fill='#8fa3c9'/><line x1='14' y1='9' x2='14' y2='18' stroke='#8fa3c9' stroke-width='2'/><line x1='14' y1='11' x2='9' y2='4' stroke='#8fa3c9' stroke-width='2'/><line x1='14' y1='11' x2='19' y2='4' stroke='#8fa3c9' stroke-width='2'/><line x1='14' y1='18' x2='10' y2='25' stroke='#8fa3c9' stroke-width='2'/><line x1='14' y1='18' x2='18' y2='25' stroke='#8fa3c9' stroke-width='2'/>`);
  if (t === 'delete') return w(`<circle cx='14' cy='14' r='10.5' fill='#fff' stroke='#b3261e' stroke-width='2'/><line x1='9.5' y1='9.5' x2='18.5' y2='18.5' stroke='#b3261e' stroke-width='2.4'/><line x1='18.5' y1='9.5' x2='9.5' y2='18.5' stroke='#b3261e' stroke-width='2.4'/>`);
  return '';
}

// Musecursor der repræsenterer det valgte værktøj (lille SVG-ikon).
function toolCursor(t) {
  const cur = (body, hx, hy) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>${body}</svg>`)}") ${hx} ${hy}, crosshair`;
  if (t === 'select') return 'grab';
  if (t === 'post') return cur(`<line x1='14' y1='3' x2='14' y2='25' stroke='#0b66c3' stroke-width='1.5'/><line x1='3' y1='14' x2='25' y2='14' stroke='#0b66c3' stroke-width='1.5'/><rect x='9' y='9' width='10' height='10' rx='2' fill='#b6986a' stroke='#6b4f2a' stroke-width='1.3'/>`, 14, 14);
  if (t === 'connect') return cur(`<line x1='14' y1='14' x2='6' y2='22' stroke='#0b66c3' stroke-width='1.8'/><line x1='14' y1='14' x2='22' y2='6' stroke='#0b66c3' stroke-width='1.8'/><circle cx='6' cy='22' r='2.8' fill='#fff' stroke='#0b66c3' stroke-width='1.5'/><circle cx='22' cy='6' r='2.8' fill='#fff' stroke='#0b66c3' stroke-width='1.5'/><circle cx='14' cy='14' r='2.8' fill='#0b66c3'/>`, 14, 14);
  if (t === 'ladder') return 'crosshair';   // spøgelses-stigen viser placeringen
  if (t === 'avatar') return cur(`<circle cx='14' cy='6' r='3' fill='#8fa3c9'/><line x1='14' y1='9' x2='14' y2='18' stroke='#8fa3c9' stroke-width='2'/><line x1='14' y1='11' x2='9' y2='4' stroke='#8fa3c9' stroke-width='2'/><line x1='14' y1='11' x2='19' y2='4' stroke='#8fa3c9' stroke-width='2'/><line x1='14' y1='18' x2='10' y2='25' stroke='#8fa3c9' stroke-width='2'/><line x1='14' y1='18' x2='18' y2='25' stroke='#8fa3c9' stroke-width='2'/>`, 14, 18);
  if (t === 'delete') return cur(`<circle cx='14' cy='14' r='11' fill='#fff' stroke='#b3261e' stroke-width='2'/><line x1='9' y1='9' x2='19' y2='19' stroke='#b3261e' stroke-width='2.4'/><line x1='19' y1='9' x2='9' y2='19' stroke='#b3261e' stroke-width='2.4'/>`, 14, 14);
  return 'crosshair';
}

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
    const selPanel = el('div', { class: 'conntable-area side' });
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
    const colorOf = ref => materialColor(connMat(ref));   // blå = rør, brun = træ
    const libOpts = () => sortLibrary(design.library).map(m => [m.id, m.name]);
    const byPost = () => Object.fromEntries(design.posts.map(p => [p.id, p]));
    const postLetter = id => { const i = design.posts.findIndex(p => p.id === id); return i < 0 ? '?' : letterFor(i); };
    const connLabel = c => [postLetter(c.a), postLetter(c.b)].sort().join('–');
    const spanOf = (c, byId) => { const a = byId[c.a], b = byId[c.b]; return (a && b) ? Math.hypot(b.x_m - a.x_m, b.z_m - a.z_m) : 0; };
    const nearestPost = (wx, wz) => { let best = null, bd = Infinity; for (const p of design.posts) { const d = Math.hypot(p.x_m - wx, p.z_m - wz); if (d < bd) { bd = d; best = p; } } return best; };
    // Find det bedste sted at sætte en stige: nærmeste stolpe, og vinklen
    // snapper til retningen af den nærmeste bar på den stolpe (så stigen
    // "klikker fast" langs en faktisk forbindelse).
    const ladderSnap = (wx, wz) => {
      const np = nearestPost(wx, wz);
      if (!np) return null;
      const cur = Math.atan2(wz - np.z_m, wx - np.x_m);
      const conns = design.connections.filter(c => c.a === np.id || c.b === np.id);
      if (!conns.length) return { postId: np.id, angle_rad: cur };
      const byId = byPost();
      let best = cur, bd = Infinity;
      for (const c of conns) {
        const o = byId[c.a === np.id ? c.b : c.a]; if (!o) continue;
        const a = Math.atan2(o.z_m - np.z_m, o.x_m - np.x_m);
        const diff = Math.abs(((a - cur + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
        if (diff < bd) { bd = diff; best = a; }
      }
      return { postId: np.id, angle_rad: best };
    };
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
    // Effektiv (bærende) spændvidde: en stige der binder til baren, virker som
    // et ekstra støttepunkt og aflaster den (som i den oprindelige version) —
    // det længste ustøttede stykke bliver styrende for styrke/nedbøjning.
    const effSpanOf = (c, byId) => {
      const span = spanOf(c, byId);
      let relief = 0;
      for (const at of design.attachments) {
        if (at.type !== 'ladder') continue;
        const bar = ladderBar(at, byId);
        if (bar && bar.conn && bar.conn.id === c.id) relief = Math.max(relief, at.width_m || 0.5);
      }
      return relief > 0 ? Math.max(0.05, Math.max(relief, span - relief)) : span;
    };

    function setHelp() { help.textContent = tt('site.help.' + tool); mapBox.style.cursor = toolCursor(tool); }

    // Tegn en stige (plan-symbol) for et attachment- eller spøgelses-objekt
    // {postId, angle_rad, width_m}. mode: 'normal' | 'ghost' | 'ghostDown'.
    function ladderMarkup(at, byId, mode) {
      const p = byId[at.postId]; if (!p) return '';
      const side = Math.max(7, postSideM() * view.k);
      const cxw = design.posts.reduce((s, q) => s + q.x_m, 0) / (design.posts.length || 1);
      const czw = design.posts.reduce((s, q) => s + q.z_m, 0) / (design.posts.length || 1);
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
      const ghost = mode === 'ghost' || mode === 'ghostDown';
      const col = ghost ? '#4f9bff' : '#0e7490';
      let rungs = '';
      const nR = Math.max(2, Math.round(L / 12));
      for (let j = 0; j <= nR; j++) { const t = j / nR; rungs += `<line x1="${(r1x + (r1ex - r1x) * t).toFixed(1)}" y1="${(r1y + (r1ey - r1y) * t).toFixed(1)}" x2="${(r2x + (r2ex - r2x) * t).toFixed(1)}" y2="${(r2y + (r2ey - r2y) * t).toFixed(1)}" stroke="${col}" stroke-width="1.4"/>`; }
      if (ghost) {
        const dash = mode === 'ghostDown' ? '' : 'stroke-dasharray="5 3"';
        return `<g pointer-events="none" opacity="${mode === 'ghostDown' ? 0.9 : 0.55}">
          <line x1="${r1x.toFixed(1)}" y1="${r1y.toFixed(1)}" x2="${r1ex.toFixed(1)}" y2="${r1ey.toFixed(1)}" stroke="${col}" stroke-width="2" ${dash}/>
          <line x1="${r2x.toFixed(1)}" y1="${r2y.toFixed(1)}" x2="${r2ex.toFixed(1)}" y2="${r2ey.toFixed(1)}" stroke="${col}" stroke-width="2" ${dash}/>
          ${rungs}
          <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="3.4" fill="${col}"/></g>`;
      }
      const selL = at.id === selectedLadder ? `<line x1="${ox.toFixed(1)}" y1="${oy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#4f9bff" stroke-width="${(wHalf * 2 + 8).toFixed(1)}" stroke-linecap="round" opacity="0.3"/>` : '';
      return `<g data-el="ladder" data-id="${at.id}">${selL}
        <line x1="${r1x.toFixed(1)}" y1="${r1y.toFixed(1)}" x2="${r1ex.toFixed(1)}" y2="${r1ey.toFixed(1)}" stroke="#0e7490" stroke-width="2"/>
        <line x1="${r2x.toFixed(1)}" y1="${r2y.toFixed(1)}" x2="${r2ex.toFixed(1)}" y2="${r2ey.toFixed(1)}" stroke="#0e7490" stroke-width="2"/>
        ${rungs}
        <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="3.4" fill="#0e7490"/>
        <line x1="${ox.toFixed(1)}" y1="${oy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#000" opacity="0" stroke-width="${(wHalf * 2 + 8).toFixed(1)}" pointer-events="all"/></g>`;
    }

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
        grid += `<line x1="${sx.toFixed(1)}" y1="0" x2="${sx.toFixed(1)}" y2="${H}" stroke="${axis ? 'rgba(170,195,225,.5)' : 'rgba(140,162,195,.2)'}" stroke-width="${axis ? 1.2 : 1}"/>`;
      }
      for (let z = Math.ceil(minWz / step) * step; z <= maxWz; z += step) {
        const [, sy] = toScreen(0, z); const axis = Math.abs(z) < 1e-9;
        grid += `<line x1="0" y1="${sy.toFixed(1)}" x2="${W}" y2="${sy.toFixed(1)}" stroke="${axis ? 'rgba(170,195,225,.5)' : 'rgba(140,162,195,.2)'}" stroke-width="${axis ? 1.2 : 1}"/>`;
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
        const critical = span > 0 && beam(effSpanOf(c, byId), mat, 1, 0.25).pYield < refLoad;
        const X1 = ax.toFixed(1), Y1 = ay.toFixed(1), X2 = bx.toFixed(1), Y2 = by.toFixed(1);
        const mx = ((ax + bx) / 2).toFixed(1), my = ((ay + by) / 2).toFixed(1);
        if (c.id === selectedConn) conns += `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="#4f9bff" stroke-width="${sw + 6}" stroke-linecap="round" opacity="0.45"/>`;
        if (critical) conns += `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="#e11d1d" stroke-width="${sw + 5}" stroke-linecap="round" opacity="0.5"/>`;
        conns += `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="${colorOf(c.material)}" stroke-width="${sw}" stroke-linecap="round"/>`;
        conns += `<line data-el="conn" data-id="${c.id}" x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="#000" opacity="0" stroke-width="14" stroke-linecap="round" pointer-events="all"/>`;
        if (!live) { const lbl = connLabel(c); conns += `<g pointer-events="none"><ellipse cx="${mx}" cy="${my}" rx="${(6 + lbl.length * 2.6).toFixed(1)}" ry="8.5" fill="#1a212c" stroke="#4f9bff"/><text x="${mx}" y="${(+my + 3).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#8bbcfd">${lbl}</text></g>`; }
      });

      // ---- stiger: lodret stige der binder sig til en vandret bar (som i 3D).
      // Plan-symbol: en stige langs baren, fra stolpen og 'stigebredde' ud. ----
      let ladders = '';
      for (const at of design.attachments) {
        if (at.type !== 'ladder') continue;
        ladders += ladderMarkup(at, byId, 'normal');
      }
      // spøgelses-stige (forhåndsvisning ved placering med stige-værktøjet)
      let ghostLad = '';
      if (ghostLadder) ghostLad = ladderMarkup(ghostLadder, byId, ghostLadder.down ? 'ghostDown' : 'ghost');

      // ---- avatarer (person set oppefra: hoved + skuldre) ----
      let avatars = '';
      for (const at of design.attachments) {
        if (at.type !== 'avatar') continue;
        const [sx, sy] = toScreen(at.x_m, at.z_m);
        const rS = Math.max(7, 0.22 * view.k), rH = Math.max(3, 0.1 * view.k);
        const selA = at.id === selectedAvatar;
        avatars += `<g data-el="avatar" data-id="${at.id}">
          <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${rS.toFixed(1)}" fill="#8fa3c9" fill-opacity="0.28" stroke="${selA ? '#4f9bff' : '#8fa3c9'}" stroke-width="${selA ? 2.4 : 1.2}"/>
          <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${rH.toFixed(1)}" fill="#8fa3c9"/>
          <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${(rS + 4).toFixed(1)}" fill="#000" opacity="0" pointer-events="all"/></g>`;
      }

      let posts = '';
      design.posts.forEach((p, i) => {
        const [sx, sy] = toScreen(p.x_m, p.z_m);
        const sel = p.id === selectedPost || p.id === connectFrom;
        posts += `<rect data-el="post" data-id="${p.id}" x="${(sx - side / 2).toFixed(1)}" y="${(sy - side / 2).toFixed(1)}" width="${side.toFixed(1)}" height="${side.toFixed(1)}" rx="2" fill="#b6986a" stroke="${sel ? '#4f9bff' : '#7a5d35'}" stroke-width="${sel ? 2.5 : 1.2}"/>`;
        if (!live) posts += `<text x="${(sx + side / 2 + 3).toFixed(1)}" y="${(sy - side / 2 - 2).toFixed(1)}" font-size="11" font-weight="700" fill="#fb923c" paint-order="stroke" stroke="#0e141c" stroke-width="2.6" pointer-events="none">${letterFor(i)}</text>`;
      });

      const empty = design.posts.length === 0
        ? `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="13" fill="#9aa6b2">${tt('site.empty')}</text>` : '';

      // ---- målestok (fast overlay) ----
      const sc = niceScale(); const spx = sc.meters * view.k;
      const sbx = 14, sby = H - 14;
      const scale = `<g pointer-events="none">
        <rect x="${sbx - 6}" y="${(sby - 20).toFixed(1)}" width="${(spx + 12).toFixed(1)}" height="28" fill="#1a212c" opacity="0.85" rx="4"/>
        <line x1="${sbx}" y1="${sby}" x2="${(sbx + spx).toFixed(1)}" y2="${sby}" stroke="#c2cdd8" stroke-width="2.5"/>
        <line x1="${sbx}" y1="${sby - 5}" x2="${sbx}" y2="${sby + 5}" stroke="#c2cdd8" stroke-width="2.5"/>
        <line x1="${(sbx + spx).toFixed(1)}" y1="${sby - 5}" x2="${(sbx + spx).toFixed(1)}" y2="${sby + 5}" stroke="#c2cdd8" stroke-width="2.5"/>
        <text x="${(sbx + spx / 2).toFixed(1)}" y="${sby - 7}" text-anchor="middle" font-size="11" font-weight="600" fill="#c2cdd8">${sc.label}</text></g>`;

      // ---- justerings-hjælpelinjer (stiplet) + spøgelses-stolpe ----
      let guideSvg = '';
      if (guides) {
        if (guides.x != null) { const [gx] = toScreen(guides.x, 0); guideSvg += `<line x1="${gx.toFixed(1)}" y1="0" x2="${gx.toFixed(1)}" y2="${H}" stroke="#4f9bff" stroke-width="1" stroke-dasharray="5 4" opacity="0.8"/>`; }
        if (guides.z != null) { const [, gy] = toScreen(0, guides.z); guideSvg += `<line x1="0" y1="${gy.toFixed(1)}" x2="${W}" y2="${gy.toFixed(1)}" stroke="#4f9bff" stroke-width="1" stroke-dasharray="5 4" opacity="0.8"/>`; }
        if (guides.ghost) { const [gx, gy] = toScreen(guides.ghost.x, guides.ghost.z); guideSvg += `<rect x="${(gx - side / 2).toFixed(1)}" y="${(gy - side / 2).toFixed(1)}" width="${side.toFixed(1)}" height="${side.toFixed(1)}" rx="2" fill="#b6986a" fill-opacity="0.4" stroke="#4f9bff" stroke-width="1.4" stroke-dasharray="4 3"/>`; }
      }

      mapBox.innerHTML =
        `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:100%">` +
        `<rect data-el="bg" x="0" y="0" width="${W}" height="${H}" fill="transparent"/>` +
        grid + conns + ladders + avatars + posts + ghostLad + guideSvg + empty + scale + `</svg>`;
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
    const stopProp = e => e.stopPropagation();
    function renderPanel() {
      clear(selPanel);
      const refLoad = design.site.refLoad_kg || 120;
      const byId = byPost();
      const postH = id => { const p = byId[id]; return p ? (p.height_m != null ? p.height_m : (design.site.postHeight_m || 3.0)) : (design.site.postHeight_m || 3.0); };
      const maxBarH = c => Math.min(postH(c.a), postH(c.b));
      // håndhæv invarianter: bar-højde i [0, laveste stolpe]
      design.connections.forEach(c => { const mh = maxBarH(c); if (c.height_m > mh) c.height_m = mh; else if (c.height_m < 0) c.height_m = 0; });

      // ---- Stolper (navn + højde) — øverst, jf. fane-rækkefølgen ----
      if (design.posts.length) {
        selPanel.append(el('h3', {}, tt('site.posts.title')));
        const phead = el('tr', {}, el('th', {}, '#'), el('th', {}, `${tt('site.postheight')} (${suTxt})`));
        const prows = design.posts.map((p, i) => {
          const h = p.height_m != null ? p.height_m : (design.site.postHeight_m || 3.0);
          const hInp = el('input', { type: 'number', step: su === 'ft' ? '0.1' : '0.05', min: String(round(lenFromSI(0.1, su))), value: String(round(lenFromSI(h, su))) });
          const clampPost = (v, commit) => {
            const m = Math.max(lenToSI(v, su), 0.1);
            store.update(d => {
              const q = d.posts.find(x => x.id === p.id); if (q) q.height_m = m;
              const ph = id => { const pp = d.posts.find(x => x.id === id); return pp ? (pp.height_m != null ? pp.height_m : (d.site.postHeight_m || 3.0)) : (d.site.postHeight_m || 3.0); };
              d.connections.forEach(cc => { if (cc.a === p.id || cc.b === p.id) { const mx = Math.min(ph(cc.a), ph(cc.b)); if (cc.height_m > mx) cc.height_m = mx; } });
            });
            redraw();
            if (commit) renderPanel();   // opdater bar-højder i tabellen efter klamp
          };
          hInp.addEventListener('input', () => { const v = parseFloat(hInp.value); if (!isNaN(v)) clampPost(v, false); });
          hInp.addEventListener('change', () => { hInp.value = String(round(lenFromSI(Math.max(lenToSI(parseFloat(hInp.value) || 0, su), 0.1), su))); clampPost(parseFloat(hInp.value), true); });
          hInp.addEventListener('pointerdown', stopProp);
          const tr = el('tr', { class: 'crow' + (p.id === selectedPost ? ' on' : '') },
            el('td', {}, el('span', { class: 'pdot' }), letterFor(i)),
            el('td', { class: 'editc' }, hInp));
          tr.addEventListener('click', e => { if (e.target.closest('input,select')) return; selectedPost = p.id; selectedConn = null; selectedLadder = null; redraw(); renderPanel(); });
          return tr;
        });
        selPanel.append(el('table', { class: 'conntab full dense posts-tab' }, el('thead', {}, phead), el('tbody', {}, ...prows)));
      }

      // ---- Forbindelser (kompakt) ----
      selPanel.append(el('h3', { class: 'posts-h' }, tt('site.conn.tableTitle')));
      if (!design.connections.length) {
        selPanel.append(el('p', { class: 'sel-hint' }, tt('site.conn.empty')));
      } else {
        const head = el('tr', {},
          el('th', {}, '#'),
          el('th', {}, tt('site.conn.th.mat')),
          el('th', {}, `H (${suTxt})`),
          el('th', {}, `L (${suTxt})`),
          el('th', {}, `${tt('site.conn.th.load')} (kg)`),
          el('th', {}, `${tt('bar.res.ultimate')} (kg)`),
          el('th', {}, `↓ ${Math.round(refLoad)}kg`));
        const rows = design.connections.map(c => {
          const mat = connMat(c.material), span = spanOf(c, byId);
          const res = () => beam(Math.max(effSpanOf(c, byPost()), 0.05), connMat(c.material), refLoad, 0.25);
          const safeCell = el('td', { class: 'numc' }, ''), ultCell = el('td', { class: 'numc' }, ''), deflCell = el('td', { class: 'numc' }, '');
          const tr = el('tr', {});
          const paint = () => {
            const r = res(), crit = r.pYield < refLoad;
            clear(safeCell); safeCell.append(`${Math.round(r.pYield)}${crit ? ' ⚠' : ''}`);
            clear(ultCell); ultCell.append(`${Math.round(r.pUlt)}`);
            clear(deflCell); deflCell.append(fmtDispl(r.dReal * 1000, 'mm', lang));
            tr.className = 'crow' + (c.id === selectedConn ? ' on' : '') + (crit ? ' crit' : '');
          };
          const matSel = select(libOpts(), mat.id, v => {
            store.update(d => { d.connections.find(x => x.id === c.id).material = { source: 'library', id: v }; });
            redraw(); renderPanel();
          });
          // højde: 0 ≤ h ≤ laveste stolpe
          const mh = maxBarH(c);
          const hInp = el('input', { type: 'number', step: su === 'ft' ? '0.1' : '0.05', min: '0', max: String(round(lenFromSI(mh, su))),
            value: String(round(lenFromSI(c.height_m, su))), title: `${tt('site.barheight.max')} ${fmt(lenFromSI(mh, su), 2, lang)} ${suTxt}` });
          hInp.addEventListener('input', () => { const v = parseFloat(hInp.value); if (isNaN(v)) return; const m = Math.min(Math.max(lenToSI(v, su), 0), mh); store.update(d => { d.connections.find(x => x.id === c.id).height_m = m; }); redraw(); });
          hInp.addEventListener('change', () => { hInp.value = String(round(lenFromSI(Math.min(Math.max(lenToSI(parseFloat(hInp.value) || 0, su), 0), mh), su))); });
          // længde: ≥ 0,1 m; flytter stolpe c.b langs forbindelsen
          const lInp = el('input', { type: 'number', step: su === 'ft' ? '0.1' : '0.05', min: String(round(lenFromSI(0.1, su))),
            value: String(round(lenFromSI(span, su))), title: `${tt('site.length.moves')} ${postLetter(c.b)}` });
          lInp.addEventListener('input', () => { const v = parseFloat(lInp.value); if (isNaN(v)) return; setSpan(c, Math.max(lenToSI(v, su), 0.1)); redraw(); paint(); });
          lInp.addEventListener('change', () => { lInp.value = String(round(lenFromSI(Math.max(lenToSI(parseFloat(lInp.value) || 0, su), 0.1), su))); redraw(); renderPanel(); });
          [matSel, hInp, lInp].forEach(x => x.addEventListener('pointerdown', stopProp));
          tr.addEventListener('click', e => { if (e.target.closest('select,input')) return; selectedConn = c.id; selectedPost = null; selectedLadder = null; redraw(); renderPanel(); });
          tr.append(
            el('td', {}, el('span', { class: 'cdot', style: `background:${colorOf(c.material)}` }), connLabel(c)),
            el('td', { class: 'editc' }, matSel),
            el('td', { class: 'editc' }, hInp),
            el('td', { class: 'editc' }, lInp),
            safeCell, ultCell, deflCell);
          paint();
          return tr;
        });
        selPanel.append(el('table', { class: 'conntab full dense' }, el('thead', {}, head), el('tbody', {}, ...rows)));
      }
      const sw = (col, label, h) => el('span', { class: 'leg-item' }, el('span', { class: 'leg-sw', style: `background:${col}${h ? `;height:${h}px` : ''}` }), label);
      selPanel.append(el('div', { class: 'legend' },
        sw('#0b66c3', tt('site.legend.pipe')),
        sw('#a06a32', tt('site.legend.wood')),
        sw('#e11d1d', tt('site.legend.crit'), 6)));
      selPanel.append(el('p', { class: 'encnote' }, tt('site.conn.encoding')));

      // ---- Personer (én pr. avatar, redigerbar højde + rækkehøjde) ----
      const avatars = design.attachments.filter(a => a.type === 'avatar');
      if (avatars.length) {
        selPanel.append(el('h3', { class: 'posts-h' }, tt('site.persons.title')));
        const ahead = el('tr', {}, el('th', {}, '#'), el('th', {}, `${tt('site.avatarheight')} (${suTxt})`), el('th', {}, `${tt('site.avatar.reach')} (${suTxt})`));
        const arows = avatars.map((a, i) => {
          const h = a.height_m || 1.8;
          const reachCell = el('td', { class: 'numc' }, fmt(lenFromSI(h * 1.25, su), 2, lang));
          const hInp = el('input', { type: 'number', step: su === 'ft' ? '0.1' : '0.05', min: String(round(lenFromSI(0.3, su))), value: String(round(lenFromSI(h, su))) });
          hInp.addEventListener('input', () => { const v = parseFloat(hInp.value); if (isNaN(v)) return; const m = Math.max(lenToSI(v, su), 0.3); store.update(d => { const x = d.attachments.find(y => y.id === a.id); if (x) x.height_m = m; }); clear(reachCell); reachCell.append(fmt(lenFromSI(m * 1.25, su), 2, lang)); redraw(); });
          hInp.addEventListener('change', () => { hInp.value = String(round(lenFromSI(Math.max(lenToSI(parseFloat(hInp.value) || 0, su), 0.3), su))); });
          hInp.addEventListener('pointerdown', stopProp);
          const tr = el('tr', { class: 'crow' + (a.id === selectedAvatar ? ' on' : '') },
            el('td', {}, el('span', { class: 'adot' }), i + 1),
            el('td', { class: 'editc' }, hInp), reachCell);
          tr.addEventListener('click', e => { if (e.target.closest('input,select')) return; selectedAvatar = a.id; selectedPost = null; selectedConn = null; selectedLadder = null; redraw(); renderPanel(); });
          return tr;
        });
        selPanel.append(el('table', { class: 'conntab full dense persons-tab' }, el('thead', {}, ahead), el('tbody', {}, ...arows)));
      }
    }

    // ---- interaktion (husk klik-mål ved pointerdown — robust mod pan-capture) ----
    let drag = null, down = null, guides = null, ghostLadder = null;
    mapBox.addEventListener('pointerdown', e => {
      const [ux, uy] = evtToUser(e);
      const t = e.target.closest('[data-el]');
      down = { kind: t && t.getAttribute('data-el'), id: t && t.getAttribute('data-id'), ux, uy };
      if (tool === 'select' && down.kind === 'post') { drag = { mode: 'move', id: down.id, sux: ux, suy: uy, moved: false }; try { mapBox.setPointerCapture(e.pointerId); } catch (_) {} }
      else if (tool === 'select' && down.kind === 'ladder') { drag = { mode: 'ladder', id: down.id, sux: ux, suy: uy, moved: false }; try { mapBox.setPointerCapture(e.pointerId); } catch (_) {} }
      else if (tool === 'select' && down.kind === 'avatar') { drag = { mode: 'avatar', id: down.id, sux: ux, suy: uy, moved: false }; try { mapBox.setPointerCapture(e.pointerId); } catch (_) {} }
      else if (tool === 'select') { drag = { mode: 'pan', sux: ux, suy: uy, stx: view.tx, sty: view.ty, moved: false }; try { mapBox.setPointerCapture(e.pointerId); } catch (_) {} }
      else if (tool === 'ladder') {
        // start placering: stigen snapper fast og følges med (placeres ved slip)
        const [wx, wz] = toWorld(ux, uy);
        const sp = ladderSnap(wx, wz);
        ghostLadder = sp ? { ...sp, width_m: design.site.ladderWidth_m, down: true } : null;
        drag = { mode: 'place-ladder', sux: ux, suy: uy, moved: false };
        try { mapBox.setPointerCapture(e.pointerId); } catch (_) {}
        redraw();
      }
    });
    mapBox.addEventListener('pointermove', e => {
      if (!drag) {
        const [ux, uy] = evtToUser(e);
        // forhåndsvisning + justeringslinjer når man placerer en stolpe
        if (tool === 'post') {
          const [wx, wz] = toWorld(ux, uy);
          const al = alignSnap(wx, wz, null);
          guides = { x: al.x, z: al.z, ghost: { x: al.x != null ? al.x : snap(wx), z: al.z != null ? al.z : snap(wz) } };
          redraw();
        } else if (tool === 'ladder') {
          // spøgelses-stige følger musen og snapper til mulige steder
          const [wx, wz] = toWorld(ux, uy);
          const sp = ladderSnap(wx, wz);
          ghostLadder = sp ? { ...sp, width_m: design.site.ladderWidth_m, down: false } : null;
          redraw();
        } else if (guides || ghostLadder) { guides = null; ghostLadder = null; redraw(); }
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
      else if (drag.mode === 'place-ladder') {
        const [wx, wz] = toWorld(ux, uy);
        const sp = ladderSnap(wx, wz);
        ghostLadder = sp ? { ...sp, width_m: design.site.ladderWidth_m, down: true } : null;
        redraw(true);
      }
      else if (drag.mode === 'ladder') {
        const at = design.attachments.find(a => a.id === drag.id); if (!at) return;
        const [wx, wz] = toWorld(ux, uy);
        const sp = ladderSnap(wx, wz);
        if (sp) { at.postId = sp.postId; at.angle_rad = sp.angle_rad; }
        redraw(true);
      }
      else if (drag.mode === 'avatar') {
        const at = design.attachments.find(a => a.id === drag.id); if (!at) return;
        const [wx, wz] = toWorld(ux, uy);
        at.x_m = snap(wx); at.z_m = snap(wz);
        redraw(true);
      }
    });
    mapBox.addEventListener('pointerup', () => {
      const mode = drag && drag.mode;
      // stige-værktøj: placér endeligt der hvor spøgelset snappede fast
      if (mode === 'place-ladder') {
        const sp = ghostLadder;
        if (sp) store.update(d => d.attachments.push({ id: nextId(d.attachments, 'a'), type: 'ladder', postId: sp.postId, width_m: d.site.ladderWidth_m, angle_rad: sp.angle_rad }));
        drag = null; down = null; ghostLadder = null;
        redraw(); renderPanel();
        return;
      }
      const wasDrag = drag && drag.moved;
      if (wasDrag && (mode === 'move' || mode === 'ladder' || mode === 'avatar')) store.commit();
      drag = null; guides = null;
      if (wasDrag) redraw();                              // gentegn med bogstav-labels igen
      if (wasDrag && (mode === 'move' || mode === 'ladder' || mode === 'avatar')) renderPanel();
      if (!wasDrag && down) handleClick(down.kind, down.id, down.ux, down.uy);
      down = null;
    });
    mapBox.addEventListener('pointerleave', () => { if (!drag && (guides || ghostLadder)) { guides = null; ghostLadder = null; redraw(); } });

    function handleClick(kind, id, ux, uy) {
      if (tool === 'post' && (kind === 'bg' || !kind)) {
        const [wx, wz] = toWorld(ux, uy);
        const al = alignSnap(wx, wz, null);
        const fx = al.x != null ? al.x : snap(wx), fz = al.z != null ? al.z : snap(wz);
        store.update(d => d.posts.push({ id: nextId(d.posts, 'p'), x_m: fx, z_m: fz, height_m: d.site.postHeight_m || 3.0, override: null }));
        guides = null; redraw();
      } else if (tool === 'avatar' && (kind === 'bg' || !kind)) {
        const [wx, wz] = toWorld(ux, uy);
        store.update(d => d.attachments.push({ id: nextId(d.attachments, 'a'), type: 'avatar', x_m: snap(wx), z_m: snap(wz), height_m: d.site.avatarHeight_m || 1.8 }));
        redraw(); renderPanel();
      } else if (tool === 'select') {
        selectedPost = kind === 'post' ? id : null;
        selectedConn = kind === 'conn' ? id : null;
        selectedLadder = kind === 'ladder' ? id : null;
        selectedAvatar = kind === 'avatar' ? id : null;
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
      } else if (tool === 'delete') {
        if (kind === 'post') store.update(d => { d.posts = d.posts.filter(p => p.id !== id); d.connections = d.connections.filter(c => c.a !== id && c.b !== id); d.attachments = d.attachments.filter(at => at.postId !== id); });
        else if (kind === 'conn') store.update(d => { d.connections = d.connections.filter(c => c.id !== id); d.attachments = d.attachments.filter(at => at.connectionId !== id); });
        else if (kind === 'ladder' || kind === 'avatar') store.update(d => { d.attachments = d.attachments.filter(at => at.id !== id); });
        if (selectedPost && !design.posts.some(p => p.id === selectedPost)) selectedPost = null;
        if (selectedConn && !design.connections.some(c => c.id === selectedConn)) selectedConn = null;
        if (selectedLadder && !design.attachments.some(a => a.id === selectedLadder)) selectedLadder = null;
        if (selectedAvatar && !design.attachments.some(a => a.id === selectedAvatar)) selectedAvatar = null;
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
          onclick: () => { tool = id; connectFrom = null; selectedPost = null; selectedConn = null; selectedLadder = null; selectedAvatar = null; guides = null; ghostLadder = null; setHelp();
            palette.querySelectorAll('.toolbtn').forEach(b => b.classList.toggle('on', b.getAttribute('data-tool') === id));
            redraw(); renderPanel(); } },
          el('span', { class: 'toolbtn-i', html: toolIcon(id) }), el('span', { class: 'toolbtn-t' }, tt(key)))),
      el('div', { class: 'zoombar' },
        el('button', { class: 'btn-sm', type: 'button', title: 'zoom +', onclick: () => zoom(1.2) }, '＋'),
        el('button', { class: 'btn-sm', type: 'button', title: 'zoom −', onclick: () => zoom(1 / 1.2) }, '−'),
        el('button', { class: 'btn-sm', type: 'button', title: tt('site.fit'), onclick: fit, html: `<svg width='14' height='14' viewBox='0 0 24 24' style='vertical-align:middle'><path d='M3 8V3h5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/></svg>` })),
      el('div', { class: 'zoombar' },
        el('button', { class: 'btn-sm', type: 'button', title: tt('site.undo') + ' (Ctrl+Z)', onclick: () => { if (store.undo()) ctx.rerender(); } }, '↶'),
        el('button', { class: 'btn-sm', type: 'button', title: tt('site.redo') + ' (Ctrl+Y)', onclick: () => { if (store.redo()) ctx.rerender(); } }, '↷')));

    function zoom(f) { view.k = Math.min(MAX_K, Math.max(MIN_K, view.k * f)); redraw(); }

    const gridCm = Math.round((design.site.grid_m || 0.125) * 1000) / 10;
    const gridInp = el('input', { type: 'number', step: '0.5', min: '1', value: String(gridCm), style: 'width:70px' });
    gridInp.addEventListener('input', () => { const v = parseFloat(gridInp.value); if (v > 0) { store.update(d => { d.site.grid_m = v / 100; }); redraw(); } });

    const settings = el('div', { class: 'site-settings' },
      unitToggle(tt('units.length'), [['m', tt('unit.m')], ['ft', tt('unit.ft')]], su,
        v => { store.update(d => { d.units.site.len = v; }); ctx.rerender(); }),
      el('label', { class: 'fld inline' }, el('span', { class: 'fld-l' }, `${tt('site.grid')} (cm)`), gridInp),
      el('label', { class: 'fld inline' }, el('span', { class: 'fld-l' }, `${tt('site.ladderwidth')} (${suTxt})`),
        lenInput(design.site.ladderWidth_m, su, v => { store.update(d => { d.site.ladderWidth_m = v; }); redraw(); })),
      el('label', { class: 'fld inline', title: tt('site.refload.hint') }, el('span', { class: 'fld-l' }, `${tt('site.refload')} (kg)`),
        numInput(design.site.refLoad_kg || 120, 5, v => { store.update(d => { d.site.refLoad_kg = v; }); redraw(); renderPanel(); })));

    // Ctrl+Z / Ctrl+Y (eller Ctrl+Shift+Z) — kun aktiv mens kortet er fremme.
    if (tabSite._keyHandler) document.removeEventListener('keydown', tabSite._keyHandler);
    tabSite._keyHandler = e => {
      if (!mapBox.isConnected) { document.removeEventListener('keydown', tabSite._keyHandler); return; }
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName || '')) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); if (store.undo()) ctx.rerender(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); if (store.redo()) ctx.rerender(); }
    };
    document.addEventListener('keydown', tabSite._keyHandler);

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
