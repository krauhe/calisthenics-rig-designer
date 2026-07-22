// Fane: Kort (top-ned). Værktøjspalette, gitter m. snapping, pan/zoom,
// målestok, stolper, forbindelser (med bogstav + tykkelse=dimension + rød
// markering hvis spinkel) og stiger tegnet i deres rigtige størrelse.
// Tabel til højre viser alle forbindelser; klik for at vælge og ændre.

const W = 520, H = 440;
const MIN_K = 12, MAX_K = 400;
const MIN_SITE_GRID_M = 0.01;
const MIN_LADDER_WIDTH_M = 0.05;

let tool = 'select';
let selectedPost = null;
let selectedConn = null;
let selectedLadder = null;
let selectedMonkey = null;
let selectedAvatar = null;
let connectFrom = null;
let view = null;

const TOOLS = [
  ['select', '🖱', 'tool.select'],
  ['post', '▪', 'tool.post'],
  ['connect', '／', 'tool.connect'],
  ['ladder', '🪜', 'tool.ladder'],
  ['monkey', '🐒', 'tool.monkey'],
  ['avatar', '🧍', 'tool.avatar'],
  ['delete', '🗑', 'tool.delete'],
];

// Knap-ikon der matcher musecursoren for hvert værktøj (lille inline-SVG).
function toolIcon(t) {
  const w = b => `<svg width='18' height='18' viewBox='0 0 28 28' xmlns='http://www.w3.org/2000/svg'>${b}</svg>`;
  if (t === 'select') return w(`<path d='M10 13V7.4a1.6 1.6 0 0 1 3.2 0V12 M13.2 12V5.8a1.6 1.6 0 0 1 3.2 0V12 M16.4 12V6.6a1.6 1.6 0 0 1 3.2 0V13 M19.6 13V9a1.6 1.6 0 0 1 3.2 0v6.4c0 4-2.6 7-6.7 7h-1.1c-2 0-3.4-.8-4.7-2.4L6 17.6a1.7 1.7 0 0 1 2.7-2L10 17' fill='none' stroke='#c2cdd8' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/>`);
  if (t === 'post') return w(`<line x1='14' y1='3' x2='14' y2='25' stroke='#0b66c3' stroke-width='1.4'/><line x1='3' y1='14' x2='25' y2='14' stroke='#0b66c3' stroke-width='1.4'/><rect x='9' y='9' width='10' height='10' rx='2' fill='#b6986a' stroke='#6b4f2a' stroke-width='1.3'/>`);
  if (t === 'connect') return w(`<line x1='14' y1='14' x2='6' y2='22' stroke='#0b66c3' stroke-width='1.6'/><line x1='14' y1='14' x2='22' y2='6' stroke='#0b66c3' stroke-width='1.6'/><circle cx='6' cy='22' r='2.6' fill='#fff' stroke='#0b66c3' stroke-width='1.4'/><circle cx='22' cy='6' r='2.6' fill='#fff' stroke='#0b66c3' stroke-width='1.4'/><circle cx='14' cy='14' r='2.6' fill='#0b66c3'/>`);
  if (t === 'ladder') return w(`<line x1='10' y1='3' x2='10' y2='25' stroke='#0e7490' stroke-width='2'/><line x1='18' y1='3' x2='18' y2='25' stroke='#0e7490' stroke-width='2'/><line x1='10' y1='8' x2='18' y2='8' stroke='#0e7490' stroke-width='1.8'/><line x1='10' y1='14' x2='18' y2='14' stroke='#0e7490' stroke-width='1.8'/><line x1='10' y1='20' x2='18' y2='20' stroke='#0e7490' stroke-width='1.8'/>`);
  if (t === 'monkey') return w(`<line x1='3' y1='10' x2='25' y2='10' stroke='#0e7490' stroke-width='2'/><line x1='3' y1='18' x2='25' y2='18' stroke='#0e7490' stroke-width='2'/><line x1='8' y1='10' x2='8' y2='18' stroke='#0e7490' stroke-width='1.8'/><line x1='14' y1='10' x2='14' y2='18' stroke='#0e7490' stroke-width='1.8'/><line x1='20' y1='10' x2='20' y2='18' stroke='#0e7490' stroke-width='1.8'/>`);
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
  if (t === 'monkey') return 'crosshair';   // spøgelses-armgangen viser placeringen
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
    // Gem/genskab zoom+pan, så kortet ikke zoomer ud ved hver refresh.
    const VIEW_KEY = 'crd-site-view';
    const saveView = () => { try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch (_) {} };
    if (!view) {
      try { const v = JSON.parse(localStorage.getItem(VIEW_KEY)); if (v && isFinite(v.k) && isFinite(v.tx) && isFinite(v.ty)) view = { k: Math.min(MAX_K, Math.max(MIN_K, v.k)), tx: v.tx, ty: v.ty }; } catch (_) {}
      if (!view) view = { k: 70, tx: W / 2, ty: H * 0.6 };
    }
    const su = (design.units.site && design.units.site.len) || 'm';
    const suTxt = su === 'ft' ? tt('unit.ft') : tt('unit.m');
    const mapBox = el('div', { class: 'map', role: 'application', tabindex: '0', 'aria-label': tt('site.map.aria') });
    const selPanel = el('div', { class: 'conntable-area side' });
    const help = el('div', { class: 'map-help', 'aria-live': 'polite' });

    const toScreen = (wx, wz) => [wx * view.k + view.tx, wz * view.k + view.ty];
    const toWorld = (sx, sy) => [(sx - view.tx) / view.k, (sy - view.ty) / view.k];
    const snap = w => { const g = design.site.grid_m || 0.125; return Math.round(w / g) * g; };
    const evtToUser = e => {
      const r = mapBox.getBoundingClientRect();
      return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)];
    };
    const postSideM = () => { const m = resolveMaterial(design, design.defaults.post.materialId); return (m.kind === 'wood' ? m.side : m.od) / 1000; };
    const connMat = ref => connMatOf(design, ref);
    const colorOf = ref => materialColor(connMat(ref));   // blå = rør, brun = træ
    // Hold Kort-tabellen kompakt; fulde rørdata vises/redigeres under Materialer.
    const libOpts = () => sortLibrary(design.library).map(m => [m.id, m.name]);
    const byPost = () => Object.fromEntries(design.posts.map(p => [p.id, p]));
    const postLetter = id => postLetterOf(design, id);
    const connLabel = c => connLabelOf(design, c);
    const readableDeg = deg => {
      let a = ((deg + 180) % 360 + 360) % 360 - 180;
      if (a > 90) a -= 180;
      if (a < -90) a += 180;
      return a;
    };
    const postLabelDir = (p, idx) => postLabelDirOf(design, p, idx);
    const spanOf = c => spanOfConn(design, c);
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
    // Hvilken bar binder stigen til? Delt logik i model.js (samme i Kort/3D/Materialer/Print).
    const ladderBar = at => ladderBarOf(design, at);
    // En stige "optager" en plads = stolpe + den bar den binder til. To stiger på
    // samme plads ville ligge oven på hinanden → ugyldig dobbelt-placering.
    const ladderSlot = spot => {
      if (!spot) return null;
      const bar = ladderBar({ postId: spot.postId, angle_rad: spot.angle_rad });
      return spot.postId + ':' + (bar && bar.conn ? bar.conn.id : 'none');
    };
    const ladderSlotTaken = (spot, excludeId) => {
      const slot = ladderSlot(spot); if (!slot) return false;
      return design.attachments.some(a => a.type === 'ladder' && a.id !== excludeId
        && ladderSlot({ postId: a.postId, angle_rad: a.angle_rad }) === slot);
    };
    // ---- Armgang (monkey bars): snap til nærmeste BRUGBARE par af barer.
    // Højdeforskel blokerer ikke (udlignes ved placering) — kun geometri tæller.
    const monkeySnap = (wx, wz) => {
      let best = null, bd = Infinity;
      const cs = design.connections;
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
        const g = monkeyGeometry(design, cs[i].id, cs[j].id, design.site.monkeySpacing_m);
        if (!monkeyPairPlaceable(g)) continue;
        const d = Math.hypot(g.mid.x - wx, g.mid.z - wz);
        if (d < bd) { bd = d; best = { connA: cs[i].id, connB: cs[j].id }; }
      }
      return best;
    };
    const monkeyKey = (a, b) => [a, b].sort().join(':');
    const monkeySlotTaken = (pair, excludeId) => {
      if (!pair) return false;
      const key = monkeyKey(pair.connA, pair.connB);
      return design.attachments.some(a => a.type === 'monkey' && a.id !== excludeId
        && monkeyKey(a.connA, a.connB) === key);
    };

    // Effektiv (bærende) spændvidde med stige-aflastning — delt logik i model.js.
    const effSpanOf = c => effSpanOfConn(design, c);

    function setHelp() { help.textContent = tt('site.help.' + tool); mapBox.style.cursor = toolCursor(tool); }

    // Tegn en stige (plan-symbol) for et attachment- eller spøgelses-objekt
    // {postId, angle_rad, width_m}. mode: 'normal' | 'ghost' | 'ghostDown'.
    function ladderMarkup(at, byId, mode) {
      const p = byId[at.postId]; if (!p) return '';
      at = { ...at, width_m: Math.max(MIN_LADDER_WIDTH_M, at.width_m || 0.5) };
      const side = Math.max(7, postSideM() * view.k);
      const cxw = design.posts.reduce((s, q) => s + q.x_m, 0) / (design.posts.length || 1);
      const czw = design.posts.reduce((s, q) => s + q.z_m, 0) / (design.posts.length || 1);
      const [sx, sy] = toScreen(p.x_m, p.z_m);
      const bar = ladderBar(at);
      let dx, dy;
      if (bar) { dx = bar.dx; dy = bar.dz; }
      else { dx = p.x_m - cxw; dy = p.z_m - czw; const dl = Math.hypot(dx, dy); if (dl < 1e-6) { dx = 0; dy = 1; } else { dx /= dl; dy /= dl; } }
      const L = Math.max(12, (at.width_m || 0.5) * view.k);     // afstand stolpe→lodret rør
      const wHalf = Math.max(5, 0.085 * view.k);                // symbolbredde (kosmetisk)
      const ppx = -dy, ppy = dx;
      const ox = sx + dx * (side / 2), oy = sy + dy * (side / 2);
      const ex = ox + dx * L, ey = oy + dy * L;                 // det lodrette rør (pole)
      const r1x = ox + ppx * wHalf, r1y = oy + ppy * wHalf, r1ex = ex + ppx * wHalf, r1ey = ey + ppy * wHalf;
      const r2x = ox - ppx * wHalf, r2y = oy - ppy * wHalf, r2ex = ex - ppx * wHalf, r2ey = ey - ppy * wHalf;
      const ghost = mode === 'ghost' || mode === 'ghostDown' || mode === 'ghostBad';
      const bad = mode === 'ghostBad';
      const col = bad ? '#e11d1d' : (ghost ? '#4f9bff' : '#0e7490');
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

    // Tegn en armgang (trin mellem to barer) — normal, ghost eller ghostBad.
    function monkeyMarkup(at, mode) {
      const g = monkeyGeometry(design, at.connA, at.connB, at.spacing_m || design.site.monkeySpacing_m);
      if (!g || !g.rungs.length) return '';
      const ghost = mode === 'ghost' || mode === 'ghostDown' || mode === 'ghostBad';
      const bad = mode === 'ghostBad';
      const col = bad ? '#e11d1d' : (ghost ? '#4f9bff' : '#0e7490');
      const dash = mode === 'ghost' ? 'stroke-dasharray="5 3"' : '';
      let rungs = '';
      for (const r of g.rungs) {
        const [x1, y1] = toScreen(r.ax, r.az), [x2, y2] = toScreen(r.bx, r.bz);
        rungs += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="2.2" stroke-linecap="round" ${dash}/>`;
      }
      const f = g.rungs[0], l = g.rungs[g.rungs.length - 1];
      const [hx1, hy1] = toScreen((f.ax + f.bx) / 2, (f.az + f.bz) / 2);
      const [hx2, hy2] = toScreen((l.ax + l.bx) / 2, (l.az + l.bz) / 2);
      if (ghost) return `<g pointer-events="none" opacity="${mode === 'ghostDown' || bad ? 0.9 : 0.55}">${rungs}</g>`;
      const selM = at.id === selectedMonkey
        ? `<line x1="${hx1.toFixed(1)}" y1="${hy1.toFixed(1)}" x2="${hx2.toFixed(1)}" y2="${hy2.toFixed(1)}" stroke="#4f9bff" stroke-width="${Math.max(14, g.rungLen * view.k * 0.9).toFixed(1)}" stroke-linecap="round" opacity="0.25"/>` : '';
      return `<g data-el="monkey" data-id="${at.id}">${selM}${rungs}
        <line x1="${hx1.toFixed(1)}" y1="${hy1.toFixed(1)}" x2="${hx2.toFixed(1)}" y2="${hy2.toFixed(1)}" stroke="#000" opacity="0" stroke-width="16" stroke-linecap="round" pointer-events="all"/></g>`;
    }

    function niceScale() {
      // Fast målestok: 1 m (metrisk) ≈ 3 fod (imperial).
      if (su === 'ft') return { meters: 3 * 0.3048, label: `3 ${tt('unit.ft')}` };
      return { meters: 1, label: `1 ${tt('unit.m')}` };
    }

    // ---- stolpe-blødhed: genbruger fundament-modellen fra Stolpe-fanen.
    // Alle stolper deler post-materialet (defaults.post); dybde/hul/højde er
    // pr. stolpe. "Blød" = top-sving ≥ 20 mm (samme tærskel som Stolpe-fanen).
    const SOFT_SWAY_MM = 20;
    const postMatObj = () => resolveMaterial(design, design.defaults.post.materialId);
    const postHeightOf = p => postHeightOfD(design, p);
    const postDepthOf = p => postDepthOfD(design, p);
    const postHoleOf = p => postHoleMmOf(design, p);
    const maxBarHOf = pid => { let h = 0, found = false; for (const c of design.connections) { if (c.a === pid || c.b === pid) { found = true; h = Math.max(h, c.height_m || 0); } } return found ? h : null; };
    const postSwayMm = p => {
      const pm = postMatObj();
      const postSide = (pm.kind === 'wood' ? pm.side : pm.od) / 1000;
      const arm = maxBarHOf(p.id);
      const topHeight = Math.max(0.3, arm != null ? arm : postHeightOf(p));
      const f = foundation({ postSide, depth: Math.max(postDepthOf(p), 0.05), hole: postHoleOf(p) / 1000, topHeight, Ipost: sectionProps(pm).I, E: pm.E, kSoil: K_SOIL * soilFactorOf(design) });
      return f.dTop * 1000;
    };
    const postSoft = p => postSwayMm(p) >= SOFT_SWAY_MM;

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
        const critical = span > 0 && beam(effSpanOf(c), mat, 1, 0.25).pYield < refLoad;
        const X1 = ax.toFixed(1), Y1 = ay.toFixed(1), X2 = bx.toFixed(1), Y2 = by.toFixed(1);
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        if (c.id === selectedConn) conns += `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="#4f9bff" stroke-width="${sw + 6}" stroke-linecap="round" opacity="0.45"/>`;
        if (critical) conns += `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="#e11d1d" stroke-width="${sw + 5}" stroke-linecap="round" opacity="0.5"/>`;
        conns += `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="${colorOf(c.material)}" stroke-width="${sw}" stroke-linecap="round"/>`;
        conns += `<line data-el="conn" data-id="${c.id}" x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="#000" opacity="0" stroke-width="14" stroke-linecap="round" pointer-events="all"/>`;
        if (!live) {
          const lbl = connLabel(c);
          const aDeg = readableDeg(Math.atan2(by - ay, bx - ax) * 180 / Math.PI);
          conns += `<g pointer-events="none" transform="translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${aDeg.toFixed(1)})"><ellipse cx="0" cy="0" rx="${(7 + lbl.length * 2.8).toFixed(1)}" ry="8.5" fill="#1a212c" stroke="#4f9bff"/><text x="0" y="3.2" text-anchor="middle" font-size="10" font-weight="700" fill="#8bbcfd">${lbl}</text></g>`;
        }
        // MÅL på kortet: vis længden mens en tilstødende stolpe trækkes,
        // eller når forbindelsen er valgt — så man kan slippe på rette afstand.
        const dragged = live && drag && drag.mode === 'move' && (c.a === drag.id || c.b === drag.id);
        if (dragged || c.id === selectedConn) {
          const txt = `${fmt(lenFromSI(span, su), 2, lang)} ${suTxt}`;
          const aDeg = readableDeg(Math.atan2(by - ay, bx - ax) * 180 / Math.PI);
          const rad = aDeg * Math.PI / 180;
          const off = sw / 2 + 11;                       // vinkelret offset fra baren
          const ox2 = mx - Math.sin(rad) * off, oy2 = my + Math.cos(rad) * off;
          conns += `<g pointer-events="none" transform="translate(${ox2.toFixed(1)} ${oy2.toFixed(1)}) rotate(${aDeg.toFixed(1)})"><rect x="${(-txt.length * 3.4 - 4).toFixed(1)}" y="-8" width="${(txt.length * 6.8 + 8).toFixed(1)}" height="16" rx="4" fill="#1a212c" opacity="0.92"/><text x="0" y="3.6" text-anchor="middle" font-size="11" font-weight="700" fill="#ffd166">${txt}</text></g>`;
        }
      });

      // Lille label-badge (ellipse + tekst), samme stil som forbindelsernes.
      const badge = (x, y, txt, stroke, fill) =>
        `<g pointer-events="none" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><ellipse cx="0" cy="0" rx="${(7 + txt.length * 2.8).toFixed(1)}" ry="8.5" fill="#1a212c" stroke="${stroke}"/><text x="0" y="3.2" text-anchor="middle" font-size="10" font-weight="700" fill="${fill}">${txt}</text></g>`;

      // ---- stiger: lodret stige der binder sig til en vandret bar (som i 3D).
      // Plan-symbol: en stige langs baren, fra stolpen og 'stigebredde' ud. ----
      let ladders = '';
      for (const at of design.attachments) {
        if (at.type !== 'ladder') continue;
        ladders += ladderMarkup(at, byId, 'normal');
        // S-label ved stigens yderende (kun i "rolig" tilstand, som de øvrige labels)
        if (!live) {
          const p = byId[at.postId];
          const bar = ladderBar(at);
          if (p) {
            const dx = bar ? bar.dx : 0, dy = bar ? bar.dz : 1;
            const L = Math.max(MIN_LADDER_WIDTH_M, at.width_m || 0.5) + 0.22;
            const [lx, ly] = toScreen(p.x_m + dx * L, p.z_m + dy * L);
            ladders += badge(lx, ly, ladderLabelOf(design, at), '#0e7490', '#67d3e8');
          }
        }
      }
      // spøgelses-stige (forhåndsvisning ved placering med stige-værktøjet)
      let ghostLad = '';
      if (ghostLadder) ghostLad = ladderMarkup(ghostLadder, byId, ghostLadder.invalid ? 'ghostBad' : (ghostLadder.down ? 'ghostDown' : 'ghost'));

      // ---- armgange (monkey bars) + spøgelses-armgang ----
      let monkeys = '';
      for (const at of design.attachments) {
        if (at.type !== 'monkey') continue;
        monkeys += monkeyMarkup(at, 'normal');
        // M-label midt på armgangen
        if (!live) {
          const g2 = monkeyGeometry(design, at.connA, at.connB, at.spacing_m);
          if (g2) {
            const [mx2, my2] = toScreen(g2.mid.x, g2.mid.z);
            monkeys += badge(mx2, my2, monkeyLabelOf(design, at), '#0e7490', '#67d3e8');
          }
        }
      }
      let ghostMon = '';
      if (ghostMonkey) ghostMon = monkeyMarkup(ghostMonkey, ghostMonkey.invalid ? 'ghostBad' : (ghostMonkey.down ? 'ghostDown' : 'ghost'));

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
        if (postSoft(p)) posts += `<rect x="${(sx - side / 2 - 4).toFixed(1)}" y="${(sy - side / 2 - 4).toFixed(1)}" width="${(side + 8).toFixed(1)}" height="${(side + 8).toFixed(1)}" rx="3" fill="#e11d1d" opacity="0.5"/>`;
        posts += `<rect data-el="post" data-id="${p.id}" x="${(sx - side / 2).toFixed(1)}" y="${(sy - side / 2).toFixed(1)}" width="${side.toFixed(1)}" height="${side.toFixed(1)}" rx="2" fill="#b6986a" stroke="${sel ? '#4f9bff' : '#7a5d35'}" stroke-width="${sel ? 2.5 : 1.2}"/>`;
        if (!live) {
          const d = postLabelDir(p, i);
          const gap = Math.max(13, side / 2 + 11);
          const lx = sx + d.x * gap, ly = sy + d.z * gap;
          posts += `<g pointer-events="none" transform="translate(${lx.toFixed(1)} ${ly.toFixed(1)})"><circle r="8.5" fill="#1a212c" stroke="#fb923c" stroke-width="1.5"/><text x="0" y="3.6" text-anchor="middle" font-size="11" font-weight="800" fill="#fb923c">${letterFor(i)}</text></g>`;
        }
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
        grid + conns + ladders + monkeys + avatars + posts + ghostLad + ghostMon + guideSvg + empty + scale + `</svg>`;
    }

    // ---- forbindelses-tabel: ALLE parametre, redigerbare direkte i tabellen ----
    // Materiale (rør-dim), højde og længde er redigerbare input; sikker last,
    // brudlast og nedbøjning beregnes og vises.
    function setSpan(c, newLenSI) {
      if (!(newLenSI > 0)) return;
      store.update(d => {
        const a = d.posts.find(p => p.id === c.a), b = d.posts.find(p => p.id === c.b);
        if (!a || !b || !isFinite(newLenSI)) return;
        let ux = b.x_m - a.x_m, uz = b.z_m - a.z_m; const len = Math.hypot(ux, uz);
        if (len < 1e-6) { ux = 1; uz = 0; } else { ux /= len; uz /= len; }
        b.x_m = a.x_m + ux * newLenSI; b.z_m = a.z_m + uz * newLenSI;
      });
    }
    const stopProp = e => e.stopPropagation();
    const clearDeletedSelections = () => {
      if (selectedPost && !design.posts.some(p => p.id === selectedPost)) selectedPost = null;
      if (selectedConn && !design.connections.some(c => c.id === selectedConn)) selectedConn = null;
      if (selectedLadder && !design.attachments.some(a => a.id === selectedLadder)) selectedLadder = null;
      if (selectedMonkey && !design.attachments.some(a => a.id === selectedMonkey)) selectedMonkey = null;
      if (selectedAvatar && !design.attachments.some(a => a.id === selectedAvatar)) selectedAvatar = null;
    };
    const deleteLabel = (kind, id) => {
      if (kind === 'post') return `${tt('site.delete.post')} ${postLetter(id)}`;
      if (kind === 'conn') { const c = design.connections.find(x => x.id === id); return `${tt('site.delete.connection')} ${c ? connLabel(c) : '?'}`; }
      const at = design.attachments.find(a => a.id === id);
      if (kind === 'ladder') return `${tt('site.delete.ladder')} ${at ? ladderLabelOf(design, at) : '?'}`;
      if (kind === 'monkey') return `${tt('site.delete.monkey')} ${at ? monkeyLabelOf(design, at) : '?'}`;
      const avatars = design.attachments.filter(a => a.type === 'avatar');
      return `${tt('site.delete.person')} ${Math.max(1, avatars.findIndex(a => a.id === id) + 1)}`;
    };
    const countText = (n, one, many) => `${n} ${tt(n === 1 ? one : many)}`;
    function deleteElement(kind, id) {
      const plan = deletionPlan(design, kind, id);
      if (!plan.postIds.length && !plan.connectionIds.length && !plan.attachmentIds.length) return;
      const removedAttachments = design.attachments.filter(a => plan.attachmentIds.includes(a.id));
      const details = [];
      if (kind === 'post' && plan.connectionIds.length) details.push(countText(plan.connectionIds.length, 'site.delete.connection.one', 'site.delete.connection.many'));
      const dependentAttachments = removedAttachments.filter(a => !(a.id === id && a.type === kind));
      for (const type of ['ladder', 'monkey', 'avatar']) {
        const n = dependentAttachments.filter(a => a.type === type).length;
        if (n) details.push(countText(n, `site.delete.${type}.one`, `site.delete.${type}.many`));
      }
      if (details.length) {
        const message = `${tt('site.delete.confirm')} ${deleteLabel(kind, id)}?\n\n${tt('site.delete.also')}\n• ${details.join('\n• ')}\n\n${tt('site.delete.undo')}`;
        if (!window.confirm(message)) return;
      }
      store.update(d => applyDeletion(d, deletionPlan(d, kind, id)));
      clearDeletedSelections();
      redraw(); renderPanel();
    }
    const deleteButton = (kind, id) => {
      const label = deleteLabel(kind, id);
      const btn = el('button', { class: 'row-delete', type: 'button', title: `${tt('site.delete.button')}: ${label}`, 'aria-label': `${tt('site.delete.button')}: ${label}` }, '×');
      btn.addEventListener('click', e => { e.stopPropagation(); deleteElement(kind, id); });
      btn.addEventListener('pointerdown', stopProp);
      return btn;
    };
    // Sat af renderPanel: opdaterer forbindelses-skemaet (L + last/nedbøjning)
    // live mens man trækker en stolpe, så man kan slippe på rette afstand.
    let liveConnUpdate = null;
    function renderPanel() {
      clear(selPanel);
      liveConnUpdate = null;
      const refLoad = design.site.refLoad_kg || 120;
      const byId = byPost();
      const postH = id => { const p = byId[id]; return p ? (p.height_m != null ? p.height_m : (design.site.postHeight_m || 3.0)) : (design.site.postHeight_m || 3.0); };
      const maxBarH = c => Math.min(postH(c.a), postH(c.b));
      // ---- Stolper (navn + højde + dybde + hul; rød hvis blød) ----
      if (design.posts.length) {
        selPanel.append(el('h3', {}, tt('site.posts.title')));
        const holeUnitTxt = su === 'ft' ? tt('unit.in') : 'cm';
        const postSideMm = postSideM() * 1000;
        const holeToMm = v => su === 'ft' ? v * 25.4 : v * 10;
        const holeFromMm = mm => Math.round((su === 'ft' ? mm / 25.4 : mm / 10) * 100) / 100;
        const phead = el('tr', {}, el('th', {}, '#'),
          el('th', {}, `${tt('site.postheight')} (${suTxt})`),
          el('th', {}, `${tt('site.postdepth')} (${suTxt})`),
          el('th', {}, `${tt('site.posthole')} (${holeUnitTxt})`),
          el('th', { class: 'delete-col' }, ''));
        const prows = design.posts.map((p, i) => {
          const tr = el('tr', {});
          const paintRow = () => { const soft = postSoft(p); tr.className = 'crow' + (p.id === selectedPost ? ' on' : '') + (soft ? ' crit' : ''); tr.title = soft ? tt('site.postsoft') : ''; };
          // højde (klamper også bar-højder på stolpen)
          const hInp = el('input', { type: 'number', step: su === 'ft' ? '0.1' : '0.05', min: String(round(lenFromSI(0.1, su))), value: String(round(lenFromSI(postHeightOf(p), su))), 'aria-label': `${tt('site.delete.post')} ${letterFor(i)}: ${tt('site.postheight')} (${suTxt})` });
          const clampPost = (v, commit) => {
            const m = Math.max(lenToSI(v, su), 0.1);
            store.update(d => {
              const q = d.posts.find(x => x.id === p.id); if (q) q.height_m = m;
              const ph = id => { const pp = d.posts.find(x => x.id === id); return pp ? (pp.height_m != null ? pp.height_m : (d.site.postHeight_m || 3.0)) : (d.site.postHeight_m || 3.0); };
              d.connections.forEach(cc => { if (cc.a === p.id || cc.b === p.id) { const mx = Math.min(ph(cc.a), ph(cc.b)); if (cc.height_m > mx) cc.height_m = mx; } });
            });
            redraw(); paintRow();
            if (commit) renderPanel();   // opdater bar-højder i tabellen efter klamp
          };
          hInp.addEventListener('input', () => { const v = parseFloat(hInp.value); if (!isNaN(v)) clampPost(v, false); });
          hInp.addEventListener('change', () => { hInp.value = String(round(lenFromSI(Math.max(lenToSI(parseFloat(hInp.value) || 0, su), 0.1), su))); clampPost(parseFloat(hInp.value), true); });
          // dybde (nedgravning) — pr. stolpe
          const dInp = el('input', { type: 'number', step: su === 'ft' ? '0.1' : '0.05', min: String(round(lenFromSI(0.1, su))), value: String(round(lenFromSI(postDepthOf(p), su))), 'aria-label': `${tt('site.delete.post')} ${letterFor(i)}: ${tt('site.postdepth')} (${suTxt})` });
          const setDepth = (v, commit) => {
            const m = Math.max(lenToSI(v, su), 0.1);
            store.update(d => { const q = d.posts.find(x => x.id === p.id); if (q) q.depth_m = m; });
            redraw(); paintRow();
            if (commit) renderPanel();
          };
          dInp.addEventListener('input', () => { const v = parseFloat(dInp.value); if (!isNaN(v)) setDepth(v, false); });
          dInp.addEventListener('change', () => { dInp.value = String(round(lenFromSI(Math.max(lenToSI(parseFloat(dInp.value) || 0, su), 0.1), su))); setDepth(parseFloat(dInp.value), true); });
          // hul/betonklods — mindst stolpens sidemål
          const holeInp = el('input', { type: 'number', step: su === 'ft' ? '0.5' : '1', min: String(holeFromMm(postSideMm)),
            value: String(holeFromMm(postHoleOf(p))), title: `${tt('post.holeMin')}: ${holeFromMm(postSideMm)} ${holeUnitTxt}`,
            'aria-label': `${tt('site.delete.post')} ${letterFor(i)}: ${tt('site.posthole')} (${holeUnitTxt})` });
          const setHole = (v, commit) => {
            const mm = Math.max(holeToMm(v), postSideMm);
            store.update(d => { const q = d.posts.find(x => x.id === p.id); if (q) q.hole_mm = mm; });
            redraw(); paintRow();
            if (commit) renderPanel();
          };
          holeInp.addEventListener('input', () => { const v = parseFloat(holeInp.value); if (!isNaN(v)) setHole(v, false); });
          holeInp.addEventListener('change', () => { holeInp.value = String(holeFromMm(Math.max(holeToMm(parseFloat(holeInp.value) || 0), postSideMm))); setHole(parseFloat(holeInp.value), true); });
          [hInp, dInp, holeInp].forEach(x => x.addEventListener('pointerdown', stopProp));
          paintRow();
          tr.append(
            el('td', {}, el('span', { class: 'pdot' }), letterFor(i)),
            el('td', { class: 'editc' }, hInp),
            el('td', { class: 'editc' }, dInp),
            el('td', { class: 'editc' }, holeInp),
            el('td', { class: 'delete-col' }, deleteButton('post', p.id)));
          tr.addEventListener('click', e => { if (e.target.closest('input,select,button')) return; selectedPost = p.id; selectedConn = null; selectedLadder = null; selectedMonkey = null; selectedAvatar = null; redraw(); renderPanel(); });
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
          el('th', {}, `↓ ${Math.round(refLoad)}kg`),
          el('th', { class: 'delete-col' }, ''));
        const rowRefs = [];
        const rows = design.connections.map(c => {
          const mat = connMat(c.material), span = spanOf(c);
          const res = () => beam(Math.max(effSpanOf(c), 0.05), connMat(c.material), refLoad, 0.25);
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
            store.update(d => { const cc = d.connections.find(x => x.id === c.id); if (cc) cc.material = { source: 'library', id: v }; });
            redraw(); renderPanel();
          });
          matSel.setAttribute('aria-label', `${tt('site.delete.connection')} ${connLabel(c)}: ${tt('site.conn.th.mat')}`);
          // højde: 0 ≤ h ≤ laveste stolpe
          const mh = maxBarH(c);
          const hInp = el('input', { type: 'number', step: su === 'ft' ? '0.1' : '0.05', min: '0', max: String(round(lenFromSI(mh, su))),
            value: String(round(lenFromSI(c.height_m, su))), title: `${tt('site.barheight.max')} ${fmt(lenFromSI(mh, su), 2, lang)} ${suTxt}`,
            'aria-label': `${tt('site.delete.connection')} ${connLabel(c)}: H (${suTxt})` });
          hInp.addEventListener('input', () => { const v = parseFloat(hInp.value); if (isNaN(v)) return; const m = Math.min(Math.max(lenToSI(v, su), 0), mh); store.update(d => { const cc = d.connections.find(x => x.id === c.id); if (cc) cc.height_m = m; }); redraw(); });
          hInp.addEventListener('change', () => { hInp.value = String(round(lenFromSI(Math.min(Math.max(lenToSI(parseFloat(hInp.value) || 0, su), 0), mh), su))); });
          // længde: ≥ 0,1 m; flytter stolpe c.b langs forbindelsen
          const lInp = el('input', { type: 'number', step: su === 'ft' ? '0.1' : '0.05', min: String(round(lenFromSI(0.1, su))),
            value: String(round(lenFromSI(span, su))), title: `${tt('site.length.moves')} ${postLetter(c.b)}`,
            'aria-label': `${tt('site.delete.connection')} ${connLabel(c)}: L (${suTxt})` });
          lInp.addEventListener('input', () => { const v = parseFloat(lInp.value); if (isNaN(v)) return; setSpan(c, Math.max(lenToSI(v, su), 0.1)); redraw(); paint(); });
          lInp.addEventListener('change', () => { lInp.value = String(round(lenFromSI(Math.max(lenToSI(parseFloat(lInp.value) || 0, su), 0.1), su))); redraw(); renderPanel(); });
          [matSel, hInp, lInp].forEach(x => x.addEventListener('pointerdown', stopProp));
          tr.addEventListener('click', e => { if (e.target.closest('select,input,button')) return; selectedConn = c.id; selectedPost = null; selectedLadder = null; selectedMonkey = null; selectedAvatar = null; redraw(); renderPanel(); });
          tr.append(
            el('td', { class: 'conn-name' }, el('span', { class: 'cdot', style: `background:${colorOf(c.material)}` }), el('span', { class: 'conn-name-text' }, connLabel(c))),
            el('td', { class: 'editc' }, matSel),
            el('td', { class: 'editc' }, hInp),
            el('td', { class: 'editc' }, lInp),
            safeCell, ultCell, deflCell,
            el('td', { class: 'delete-col' }, deleteButton('conn', c.id)));
          paint();
          rowRefs.push({ c, lInp, paint });
          return tr;
        });
        selPanel.append(el('table', { class: 'conntab full dense' }, el('thead', {}, head), el('tbody', {}, ...rows)));
        // live-opdatering af L + last/nedbøjning mens en stolpe trækkes
        liveConnUpdate = () => rowRefs.forEach(({ c, lInp, paint }) => {
          if (document.activeElement !== lInp) lInp.value = String(round(lenFromSI(spanOf(c, byPost()), su)));
          paint();
        });
      }
      const sw = (col, label, h) => el('span', { class: 'leg-item' }, el('span', { class: 'leg-sw', style: `background:${col}${h ? `;height:${h}px` : ''}` }), label);
      selPanel.append(el('div', { class: 'legend' },
        sw('#0b66c3', tt('site.legend.pipe')),
        sw('#a06a32', tt('site.legend.wood')),
        sw('#e11d1d', tt('site.legend.crit'), 6)));
      selPanel.append(el('p', { class: 'encnote' }, tt('site.conn.encoding')));

      // ---- Stiger: vis og redigér de attachments, som før kun fandtes på kortet ----
      const laddersList = design.attachments.filter(a => a.type === 'ladder');
      if (laddersList.length) {
        selPanel.append(el('h3', { class: 'posts-h' }, tt('site.ladders.title')));
        const lhead = el('tr', {},
          el('th', {}, '#'), el('th', {}, tt('site.ladder.post')),
          el('th', {}, tt('site.ladder.bar')), el('th', {}, `${tt('site.ladderwidth')} (${suTxt})`),
          el('th', { class: 'delete-col' }, ''));
        const lrows = laddersList.map(a => {
          const bar = ladderBarOf(design, a);
          const widthInp = el('input', { type: 'number', step: su === 'ft' ? '0.1' : '0.05', min: String(round(lenFromSI(MIN_LADDER_WIDTH_M, su))), value: String(round(lenFromSI(a.width_m || design.site.ladderWidth_m, su))), 'aria-label': `${tt('site.delete.ladder')} ${ladderLabelOf(design, a)}: ${tt('site.ladderwidth')} (${suTxt})` });
          widthInp.addEventListener('input', () => { const v = parseFloat(widthInp.value); if (isNaN(v)) return; store.update(d => { const at = d.attachments.find(x => x.id === a.id); if (at) at.width_m = Math.max(lenToSI(v, su), MIN_LADDER_WIDTH_M); }); redraw(); });
          widthInp.addEventListener('change', () => { widthInp.value = String(round(lenFromSI(Math.max(lenToSI(parseFloat(widthInp.value) || 0, su), MIN_LADDER_WIDTH_M), su))); });
          widthInp.addEventListener('pointerdown', stopProp);
          const tr = el('tr', { class: 'crow' + (a.id === selectedLadder ? ' on' : '') },
            el('td', {}, el('span', { class: 'ladder-dot' }), ladderLabelOf(design, a)),
            el('td', { class: 'numc' }, postLetter(a.postId)),
            el('td', { class: 'numc' }, bar ? connLabel(bar.conn) : '—'),
            el('td', { class: 'editc' }, widthInp),
            el('td', { class: 'delete-col' }, deleteButton('ladder', a.id)));
          tr.addEventListener('click', e => { if (e.target.closest('input,select,button')) return; selectedLadder = a.id; selectedPost = null; selectedConn = null; selectedMonkey = null; selectedAvatar = null; redraw(); renderPanel(); });
          return tr;
        });
        selPanel.append(el('table', { class: 'conntab full dense ladders-tab' }, el('thead', {}, lhead), el('tbody', {}, ...lrows)));
      }

      // ---- Armgange: bar-par, retning, trinafstand og højde er redigerbare;
      // trin-antal/-længde beregnes, og for spinkle trin markeres med ⚠ ----
      const monkeysList = design.attachments.filter(a => a.type === 'monkey');
      if (monkeysList.length) {
        selPanel.append(el('h3', { class: 'posts-h' }, tt('site.monkeys.title')));
        const spUnitTxt = su === 'ft' ? tt('unit.in') : 'cm';
        const spToM = v => su === 'ft' ? v * 0.0254 : v / 100;
        const spFromM = m => Math.round((su === 'ft' ? m / 0.0254 : m * 100) * 10) / 10;
        // trinnene er 1"-rør (som i 3D/materialelisten) — bruges til ⚠-markeringen
        const rungMat = design.library.find(m => m.id === 'pipe-1')
          || design.library.find(m => m.kind === 'pipe')
          || { kind: 'pipe', od: 33.7, wall: 3.2, E: 210e9, sRe: 195e6, sRm: 320e6 };
        // alle brugbare bar-par (til retnings-/par-vælgeren); optagede par
        // filtreres pr. række. Højdeforskel udelukker ikke et par — den
        // udlignes automatisk, når parret vælges.
        const validPairs = [];
        for (let i = 0; i < design.connections.length; i++) {
          for (let j = i + 1; j < design.connections.length; j++) {
            const ci = design.connections[i], cj = design.connections[j];
            const g = monkeyGeometry(design, ci.id, cj.id, design.site.monkeySpacing_m);
            if (monkeyPairPlaceable(g)) validPairs.push([ci.id, cj.id]);
          }
        }
        const mhead = el('tr', {}, el('th', {}, '#'),
          el('th', {}, tt('site.monkey.pair')),
          el('th', {}, `${tt('site.monkeyspacing')} (${spUnitTxt})`),
          el('th', {}, tt('site.monkey.rungs')),
          el('th', {}, `H (${suTxt})`),
          el('th', {}, ''),
          el('th', {}, ''));
        const mrows = monkeysList.map(a => {
          const infoCell = el('td', { class: 'numc' }, '');
          const tr = el('tr', {});
          const geo = () => monkeyGeometry(design, a.connA, a.connB, a.spacing_m);
          const maxH = () => monkeyMaxHeight(design, a);
          // højde: redigerbar; skriver til BEGGE barer, klampet til laveste bærende stolpe
          const hInp = el('input', { type: 'number', step: su === 'ft' ? '0.1' : '0.05', min: '0', 'aria-label': `${tt('site.delete.monkey')} ${monkeyLabelOf(design, a)}: H (${suTxt})` });
          const paintInfo = () => {
            const g = geo();
            // ved roteret samling varierer trinlængderne — vis interval + ↻,
            // og bedøm styrken på det LÆNGSTE trin
            const weak = g && beam(Math.max(g.lenMax, 0.05), rungMat, 1, 0.25).pYield < refLoad;
            const lenTxt = !g ? '' : (g.angled
              ? `${fmt(lenFromSI(g.lenMin, su), 2, lang)}–${fmt(lenFromSI(g.lenMax, su), 2, lang)} ${suTxt} ↻`
              : `${fmt(lenFromSI(g.rungLen, su), 2, lang)} ${suTxt}`);
            clear(infoCell);
            // kryds-klemmer (Kee) passer kun på RØR — advar hvis en bar er træ
            const woodSide = g && [g.ca, g.cb].some(c => connMat(c.material).kind === 'wood');
            infoCell.append(g ? `${g.count} × ${lenTxt}${weak || woodSide ? ' ⚠' : ''}` : '—');
            infoCell.title = [weak ? tt('site.monkey.weak') : '',
              g && g.angled ? tt('site.monkey.angled') : '',
              woodSide ? tt('site.monkey.wood') : ''].filter(Boolean).join('\n');
            const mh = maxH();
            if (mh != null) { hInp.max = String(round(lenFromSI(mh, su))); hInp.title = `${tt('site.monkey.heightMax')} ${fmt(lenFromSI(mh, su), 2, lang)} ${suTxt}`; }
            if (document.activeElement !== hInp) hInp.value = g ? String(round(lenFromSI(g.y, su))) : '';
            tr.className = 'crow' + (a.id === selectedMonkey ? ' on' : '') + (weak ? ' crit' : '');
          };
          const setHeight = m => {
            const mh = maxH();
            const clamped = Math.min(Math.max(m, 0), mh != null ? mh : m);
            store.update(d => {
              const ca = d.connections.find(c => c.id === a.connA);
              const cb = d.connections.find(c => c.id === a.connB);
              if (ca) ca.height_m = clamped;
              if (cb) cb.height_m = clamped;   // trinnene hæfter i BEGGE sider → samme kote
            });
          };
          hInp.addEventListener('input', () => { const v = parseFloat(hInp.value); if (isNaN(v)) return; setHeight(lenToSI(v, su)); paintInfo(); redraw(); });
          hInp.addEventListener('change', () => { renderPanel(); });   // synk. også bar-tabellens H-felter
          // bar-par/retning: vælg blandt gyldige, ledige par
          const pairKey = (x, y) => monkeyKey(x, y);
          const curKey = pairKey(a.connA, a.connB);
          const free = validPairs.filter(([x, y]) => pairKey(x, y) === curKey
            || !design.attachments.some(o => o.type === 'monkey' && o.id !== a.id && pairKey(o.connA, o.connB) === pairKey(x, y)));
          if (!free.some(([x, y]) => pairKey(x, y) === curKey)) free.unshift([a.connA, a.connB]);
          const pairLbl = ([x, y]) => {
            const ca = design.connections.find(c => c.id === x), cb = design.connections.find(c => c.id === y);
            return (ca ? connLabel(ca) : '?') + ' × ' + (cb ? connLabel(cb) : '?');
          };
          const pairSel = select(free.map(p => [p[0] + '|' + p[1], pairLbl(p)]), a.connA + '|' + a.connB, v => {
            const [x, y] = v.split('|');
            store.update(d => {
              const m = d.attachments.find(o => o.id === a.id); if (!m) return;
              m.connA = x; m.connB = y;
              alignMonkeyBars(d, x, y);   // trinnene hæfter i samme kote i begge sider
            });
            redraw(); renderPanel();
          });
          pairSel.setAttribute('aria-label', `${tt('site.delete.monkey')} ${monkeyLabelOf(design, a)}: ${tt('site.monkey.pair')}`);
          // trinafstand
          const spInp = el('input', { type: 'number', step: su === 'ft' ? '0.5' : '1', min: String(spFromM(0.15)), value: String(spFromM(a.spacing_m || design.site.monkeySpacing_m)), 'aria-label': `${tt('site.delete.monkey')} ${monkeyLabelOf(design, a)}: ${tt('site.monkeyspacing')} (${spUnitTxt})` });
          spInp.addEventListener('input', () => { const v = parseFloat(spInp.value); if (isNaN(v)) return; const m = Math.max(spToM(v), 0.15); store.update(d => { const x = d.attachments.find(y => y.id === a.id); if (x) x.spacing_m = m; }); paintInfo(); redraw(); });
          spInp.addEventListener('change', () => { spInp.value = String(spFromM(Math.max(spToM(parseFloat(spInp.value) || 0), 0.15))); });
          // byt retning: A↔B (spejler trin-nummerering/margen for skæve par)
          const swapBtn = el('button', { class: 'btn-sm', type: 'button', title: tt('site.monkey.swap') }, '⇄');
          swapBtn.addEventListener('click', e => {
            e.stopPropagation();
            store.update(d => { const m = d.attachments.find(o => o.id === a.id); if (m) { const t2 = m.connA; m.connA = m.connB; m.connB = t2; } });
            redraw(); renderPanel();
          });
          [spInp, hInp, pairSel, swapBtn].forEach(x => x.addEventListener('pointerdown', stopProp));
          tr.append(
            el('td', {}, el('span', { class: 'pdot' }), monkeyLabelOf(design, a)),
            el('td', { class: 'editc' }, pairSel),
            el('td', { class: 'editc' }, spInp),
            infoCell,
            el('td', { class: 'editc' }, hInp),
            el('td', {}, swapBtn),
            el('td', { class: 'delete-col' }, deleteButton('monkey', a.id)));
          paintInfo();
          tr.addEventListener('click', e => { if (e.target.closest('input,select,button')) return; selectedMonkey = a.id; selectedPost = null; selectedConn = null; selectedLadder = null; selectedAvatar = null; redraw(); renderPanel(); });
          return tr;
        });
        selPanel.append(el('table', { class: 'conntab full dense' }, el('thead', {}, mhead), el('tbody', {}, ...mrows)));
      }

      // ---- Personer (én pr. avatar, redigerbar højde + rækkehøjde) ----
      const avatars = design.attachments.filter(a => a.type === 'avatar');
      if (avatars.length) {
        selPanel.append(el('h3', { class: 'posts-h' }, tt('site.persons.title')));
        const ahead = el('tr', {}, el('th', {}, '#'), el('th', {}, `${tt('site.avatarheight')} (${suTxt})`), el('th', {}, `${tt('site.avatar.reach')} (${suTxt})`), el('th', { class: 'delete-col' }, ''));
        const arows = avatars.map((a, i) => {
          const h = a.height_m || 1.8;
          const reachCell = el('td', { class: 'numc' }, fmt(lenFromSI(h * 1.25, su), 2, lang));
          const hInp = el('input', { type: 'number', step: su === 'ft' ? '0.1' : '0.05', min: String(round(lenFromSI(0.3, su))), value: String(round(lenFromSI(h, su))), 'aria-label': `${tt('site.delete.person')} ${i + 1}: ${tt('site.avatarheight')} (${suTxt})` });
          hInp.addEventListener('input', () => { const v = parseFloat(hInp.value); if (isNaN(v)) return; const m = Math.max(lenToSI(v, su), 0.3); store.update(d => { const x = d.attachments.find(y => y.id === a.id); if (x) x.height_m = m; }); clear(reachCell); reachCell.append(fmt(lenFromSI(m * 1.25, su), 2, lang)); redraw(); });
          hInp.addEventListener('change', () => { hInp.value = String(round(lenFromSI(Math.max(lenToSI(parseFloat(hInp.value) || 0, su), 0.3), su))); });
          hInp.addEventListener('pointerdown', stopProp);
          const tr = el('tr', { class: 'crow' + (a.id === selectedAvatar ? ' on' : '') },
            el('td', {}, el('span', { class: 'adot' }), i + 1),
            el('td', { class: 'editc' }, hInp), reachCell,
            el('td', { class: 'delete-col' }, deleteButton('avatar', a.id)));
          tr.addEventListener('click', e => { if (e.target.closest('input,select,button')) return; selectedAvatar = a.id; selectedPost = null; selectedConn = null; selectedLadder = null; selectedMonkey = null; redraw(); renderPanel(); });
          return tr;
        });
        selPanel.append(el('table', { class: 'conntab full dense persons-tab' }, el('thead', {}, ahead), el('tbody', {}, ...arows)));
      }
    }

    // ---- interaktion (husk klik-mål ved pointerdown — robust mod pan-capture) ----
    let drag = null, down = null, guides = null, ghostLadder = null, ghostMonkey = null;
    // Touch: aktive fingre på kortet (til pinch-zoom med to fingre).
    const touchPts = new Map();
    mapBox.addEventListener('pointerdown', e => {
      const [ux, uy] = evtToUser(e);
      if (e.pointerType === 'touch') {
        touchPts.set(e.pointerId, [ux, uy]);
        if (touchPts.size === 2) {
          // to fingre → pinch-zoom. Et igangværende element-træk afbrydes og
          // RULLES TILBAGE, så en ukommitteret flytning ikke "bages ind" senere.
          if (drag && drag.orig) {
            if (drag.mode === 'move') { const p = design.posts.find(x => x.id === drag.id); if (p) { p.x_m = drag.orig.x_m; p.z_m = drag.orig.z_m; } }
            else if (drag.mode === 'ladder') { const at = design.attachments.find(x => x.id === drag.id); if (at) { at.postId = drag.orig.postId; at.angle_rad = drag.orig.angle_rad; } }
            else if (drag.mode === 'monkey') { const at = design.attachments.find(x => x.id === drag.id); if (at) { at.connA = drag.orig.connA; at.connB = drag.orig.connB; } }
            else if (drag.mode === 'avatar') { const at = design.attachments.find(x => x.id === drag.id); if (at) { at.x_m = drag.orig.x_m; at.z_m = drag.orig.z_m; } }
          }
          const [p1, p2] = [...touchPts.values()];
          const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
          drag = { mode: 'pinch', d0: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) || 1, k0: view.k, w0: toWorld(mid[0], mid[1]) };
          guides = null; ghostLadder = null; ghostMonkey = null;
          try { mapBox.setPointerCapture(e.pointerId); } catch (_) {}
          redraw(true);
          return;
        }
      }
      const t = e.target.closest('[data-el]');
      down = { kind: t && t.getAttribute('data-el'), id: t && t.getAttribute('data-id'), ux, uy };
      // 'orig' = tilstanden ved trækstart, så pinch-afbrydelse kan rulle tilbage.
      if (tool === 'select' && down.kind === 'post') { const p = design.posts.find(x => x.id === down.id); drag = { mode: 'move', id: down.id, sux: ux, suy: uy, moved: false, orig: p ? { x_m: p.x_m, z_m: p.z_m } : null }; try { mapBox.setPointerCapture(e.pointerId); } catch (_) {} }
      else if (tool === 'select' && down.kind === 'ladder') { const at = design.attachments.find(x => x.id === down.id); drag = { mode: 'ladder', id: down.id, sux: ux, suy: uy, moved: false, orig: at ? { postId: at.postId, angle_rad: at.angle_rad } : null }; try { mapBox.setPointerCapture(e.pointerId); } catch (_) {} }
      else if (tool === 'select' && down.kind === 'monkey') { const at = design.attachments.find(x => x.id === down.id); drag = { mode: 'monkey', id: down.id, sux: ux, suy: uy, moved: false, orig: at ? { connA: at.connA, connB: at.connB } : null }; try { mapBox.setPointerCapture(e.pointerId); } catch (_) {} }
      else if (tool === 'select' && down.kind === 'avatar') { const at = design.attachments.find(x => x.id === down.id); drag = { mode: 'avatar', id: down.id, sux: ux, suy: uy, moved: false, orig: at ? { x_m: at.x_m, z_m: at.z_m } : null }; try { mapBox.setPointerCapture(e.pointerId); } catch (_) {} }
      else if (tool === 'select') { drag = { mode: 'pan', sux: ux, suy: uy, stx: view.tx, sty: view.ty, moved: false }; try { mapBox.setPointerCapture(e.pointerId); } catch (_) {} }
      else if (tool === 'ladder') {
        // start placering: stigen snapper fast og følges med (placeres ved slip)
        const [wx, wz] = toWorld(ux, uy);
        const sp = ladderSnap(wx, wz);
        ghostLadder = sp ? { ...sp, width_m: Math.max(design.site.ladderWidth_m, MIN_LADDER_WIDTH_M), down: true, invalid: ladderSlotTaken(sp, null) } : null;
        drag = { mode: 'place-ladder', sux: ux, suy: uy, moved: false };
        try { mapBox.setPointerCapture(e.pointerId); } catch (_) {}
        redraw();
      }
      else if (tool === 'monkey') {
        // start placering: armgangen snapper til nærmeste brugbare bar-par
        const [wx, wz] = toWorld(ux, uy);
        const sp = monkeySnap(wx, wz);
        ghostMonkey = sp ? { ...sp, spacing_m: design.site.monkeySpacing_m, down: true, invalid: monkeySlotTaken(sp, null) } : null;
        help.textContent = sp ? tt('site.help.monkey') : tt('site.monkey.nopair');
        drag = { mode: 'place-monkey', sux: ux, suy: uy, moved: false };
        try { mapBox.setPointerCapture(e.pointerId); } catch (_) {}
        redraw();
      }
    });
    mapBox.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch' && touchPts.has(e.pointerId)) touchPts.set(e.pointerId, evtToUser(e));
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
          ghostLadder = sp ? { ...sp, width_m: Math.max(design.site.ladderWidth_m, MIN_LADDER_WIDTH_M), down: false, invalid: ladderSlotTaken(sp, null) } : null;
          redraw();
        } else if (tool === 'monkey') {
          // spøgelses-armgang følger musen og snapper til brugbare bar-par;
          // findes der slet ingen, forklarer hjælpelinjen hvorfor
          const [wx, wz] = toWorld(ux, uy);
          const sp = monkeySnap(wx, wz);
          ghostMonkey = sp ? { ...sp, spacing_m: design.site.monkeySpacing_m, down: false, invalid: monkeySlotTaken(sp, null) } : null;
          help.textContent = sp ? tt('site.help.monkey') : tt('site.monkey.nopair');
          redraw();
        } else if (guides || ghostLadder || ghostMonkey) { guides = null; ghostLadder = null; ghostMonkey = null; redraw(); }
        return;
      }
      if (drag.mode === 'pinch') {
        if (touchPts.size < 2) return;
        const [p1, p2] = [...touchPts.values()];
        const d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) || 1;
        const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
        view.k = Math.min(MAX_K, Math.max(MIN_K, drag.k0 * d / drag.d0));
        view.tx = mid[0] - drag.w0[0] * view.k;
        view.ty = mid[1] - drag.w0[1] * view.k;
        redraw(true);
        return;
      }
      const [ux, uy] = evtToUser(e);
      if (Math.hypot(ux - drag.sux, uy - drag.suy) > 3) drag.moved = true;
      if (drag.mode === 'pan') { view.tx = drag.stx + (ux - drag.sux); view.ty = drag.sty + (uy - drag.suy); redraw(true); }
      else if (drag.mode === 'move') {
        if (!drag.moved) return;   // et rent klik må ikke grid-snappe stolpen
        const p = design.posts.find(x => x.id === drag.id); if (!p) return;
        const [wx, wz] = toWorld(ux, uy);
        const al = alignSnap(wx, wz, p.id);
        p.x_m = al.x != null ? al.x : snap(wx);
        p.z_m = al.z != null ? al.z : snap(wz);
        guides = { x: al.x, z: al.z, ghost: null };
        redraw(true);
        if (liveConnUpdate) liveConnUpdate();   // opdatér L + last i skemaet live
      }
      else if (drag.mode === 'place-ladder') {
        const [wx, wz] = toWorld(ux, uy);
        const sp = ladderSnap(wx, wz);
        ghostLadder = sp ? { ...sp, width_m: Math.max(design.site.ladderWidth_m, MIN_LADDER_WIDTH_M), down: true, invalid: ladderSlotTaken(sp, null) } : null;
        redraw(true);
      }
      else if (drag.mode === 'place-monkey') {
        const [wx, wz] = toWorld(ux, uy);
        const sp = monkeySnap(wx, wz);
        ghostMonkey = sp ? { ...sp, spacing_m: design.site.monkeySpacing_m, down: true, invalid: monkeySlotTaken(sp, null) } : null;
        redraw(true);
      }
      else if (drag.mode === 'ladder') {
        if (!drag.moved) return;
        const at = design.attachments.find(a => a.id === drag.id); if (!at) return;
        const [wx, wz] = toWorld(ux, uy);
        const sp = ladderSnap(wx, wz);
        // følg kun med til pladser der ikke allerede er optaget af en anden stige
        if (sp && !ladderSlotTaken(sp, at.id)) { at.postId = sp.postId; at.angle_rad = sp.angle_rad; }
        redraw(true);
      }
      else if (drag.mode === 'monkey') {
        if (!drag.moved) return;
        const at = design.attachments.find(a => a.id === drag.id); if (!at) return;
        const [wx, wz] = toWorld(ux, uy);
        const sp = monkeySnap(wx, wz);
        // følg kun med til bar-par der ikke allerede har en armgang
        if (sp && !monkeySlotTaken(sp, at.id)) { at.connA = sp.connA; at.connB = sp.connB; }
        redraw(true);
      }
      else if (drag.mode === 'avatar') {
        if (!drag.moved) return;
        const at = design.attachments.find(a => a.id === drag.id); if (!at) return;
        const [wx, wz] = toWorld(ux, uy);
        at.x_m = snap(wx); at.z_m = snap(wz);
        redraw(true);
      }
    });
    const endPointer = e => {
      if (e && e.pointerType === 'touch') touchPts.delete(e.pointerId);
      const mode = drag && drag.mode;
      if (mode === 'pinch') {
        if (touchPts.size < 2) { drag = null; down = null; saveView(); redraw(); }
        return;
      }
      // stige-værktøj: placér endeligt der hvor spøgelset snappede fast
      if (mode === 'place-ladder') {
        const sp = ghostLadder;
        // placér KUN hvis pladsen er ledig (ingen dobbelt-stige oven på hinanden)
        if (sp && !sp.invalid) store.update(d => d.attachments.push({ id: nextId(d.attachments, 'a'), type: 'ladder', postId: sp.postId, width_m: Math.max(d.site.ladderWidth_m, MIN_LADDER_WIDTH_M), angle_rad: sp.angle_rad }));
        drag = null; down = null; ghostLadder = null;
        redraw(); renderPanel();
        return;
      }
      // armgangs-værktøj: placér endeligt på det bar-par spøgelset snappede til.
      // Har barerne forskellig højde, udlignes de til den laveste — trinnene
      // skal hæfte i samme kote i begge sider.
      if (mode === 'place-monkey') {
        const sp = ghostMonkey;
        if (sp && !sp.invalid) store.update(d => {
          d.attachments.push({ id: nextId(d.attachments, 'a'), type: 'monkey', connA: sp.connA, connB: sp.connB, spacing_m: d.site.monkeySpacing_m });
          alignMonkeyBars(d, sp.connA, sp.connB);
        });
        drag = null; down = null; ghostMonkey = null;
        redraw(); renderPanel();
        return;
      }
      const wasDrag = drag && drag.moved;
      if (mode === 'pan') saveView();   // husk pan på tværs af refresh
      // en armgang trukket til et par med højdeforskel: udlign før commit
      if (wasDrag && mode === 'monkey') {
        const at = design.attachments.find(a => a.id === drag.id);
        if (at) alignMonkeyBars(design, at.connA, at.connB);
      }
      if (wasDrag && (mode === 'move' || mode === 'ladder' || mode === 'monkey' || mode === 'avatar')) store.commit();
      drag = null; guides = null;
      if (wasDrag) redraw();                              // gentegn med bogstav-labels igen
      if (wasDrag && (mode === 'move' || mode === 'ladder' || mode === 'monkey' || mode === 'avatar')) renderPanel();
      if (!wasDrag && down) handleClick(down.kind, down.id, down.ux, down.uy);
      down = null;
    };
    mapBox.addEventListener('pointerup', endPointer);
    mapBox.addEventListener('pointercancel', endPointer);
    mapBox.addEventListener('pointerleave', () => { if (!drag && (guides || ghostLadder || ghostMonkey)) { guides = null; ghostLadder = null; ghostMonkey = null; redraw(); } });

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
        selectedMonkey = kind === 'monkey' ? id : null;
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
        deleteElement(kind, id);
      }
    }

    mapBox.addEventListener('wheel', e => {
      e.preventDefault();
      const [ux, uy] = evtToUser(e);
      const [wx, wz] = toWorld(ux, uy);
      view.k = Math.min(MAX_K, Math.max(MIN_K, view.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      view.tx = ux - wx * view.k; view.ty = uy - wz * view.k;
      redraw(); saveView();
    }, { passive: false });

    function fit() {
      if (!design.posts.length) { view = { k: 70, tx: W / 2, ty: H * 0.6 }; redraw(); saveView(); return; }
      const xs = design.posts.map(p => p.x_m), zs = design.posts.map(p => p.z_m);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const pad = 0.6;
      const k = Math.min(MAX_K, Math.max(MIN_K, Math.min(W / (maxX - minX + 2 * pad || 1), H / (maxZ - minZ + 2 * pad || 1))));
      view = { k, tx: W / 2 - (minX + maxX) / 2 * k, ty: H / 2 - (minZ + maxZ) / 2 * k };
      redraw(); saveView();
    }

    const palette = el('div', { class: 'toolpalette' },
      ...TOOLS.map(([id, icon, key]) =>
        el('button', { class: 'toolbtn' + (tool === id ? ' on' : ''), type: 'button', title: tt(key), 'data-tool': id, 'aria-pressed': tool === id ? 'true' : 'false',
          onclick: () => { tool = id; connectFrom = null; selectedPost = null; selectedConn = null; selectedLadder = null; selectedMonkey = null; selectedAvatar = null; guides = null; ghostLadder = null; ghostMonkey = null; setHelp();
            palette.querySelectorAll('.toolbtn').forEach(b => {
              const selected = b.getAttribute('data-tool') === id;
              b.classList.toggle('on', selected);
              b.setAttribute('aria-pressed', selected ? 'true' : 'false');
            });
            redraw(); renderPanel(); } },
          el('span', { class: 'toolbtn-i', html: toolIcon(id) }), el('span', { class: 'toolbtn-t' }, tt(key)))),
      el('div', { class: 'zoombar' },
        el('button', { class: 'btn-sm', type: 'button', title: 'zoom +', onclick: () => zoom(1.2) }, '＋'),
        el('button', { class: 'btn-sm', type: 'button', title: 'zoom −', onclick: () => zoom(1 / 1.2) }, '−'),
        el('button', { class: 'btn-sm', type: 'button', title: tt('site.fit'), onclick: fit, html: `<svg width='14' height='14' viewBox='0 0 24 24' style='vertical-align:middle'><path d='M3 8V3h5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/></svg>` })),
      el('div', { class: 'zoombar' },
        // rerenderAll: fortryd erstatter design-objektet, så også header (navn/print) skal gentegnes
        el('button', { class: 'btn-sm', type: 'button', title: tt('site.undo') + ' (Ctrl+Z)', onclick: () => { if (store.undo()) ctx.rerenderAll(); } }, '↶'),
        el('button', { class: 'btn-sm', type: 'button', title: tt('site.redo') + ' (Ctrl+Y)', onclick: () => { if (store.redo()) ctx.rerenderAll(); } }, '↷')));

    // Zoom om kortets midte (ikke world-origo), så indholdet bliver i billedet.
    function zoom(f) {
      const [wx, wz] = toWorld(W / 2, H / 2);
      view.k = Math.min(MAX_K, Math.max(MIN_K, view.k * f));
      view.tx = W / 2 - wx * view.k;
      view.ty = H / 2 - wz * view.k;
      redraw(); saveView();
    }

    mapBox.addEventListener('keydown', e => {
      if (e.target !== mapBox) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoom(1.2); return; }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); zoom(1 / 1.2); return; }
      if (e.key === '0') { e.preventDefault(); fit(); return; }
      const pan = 24;
      if (e.key === 'ArrowLeft') view.tx += pan;
      else if (e.key === 'ArrowRight') view.tx -= pan;
      else if (e.key === 'ArrowUp') view.ty += pan;
      else if (e.key === 'ArrowDown') view.ty -= pan;
      else return;
      e.preventDefault();
      redraw(); saveView();
    });

    const gridCm = Math.round((design.site.grid_m || 0.125) * 1000) / 10;
    const gridInp = el('input', { type: 'number', step: '0.5', min: '1', value: String(gridCm), style: 'width:70px' });
    gridInp.addEventListener('input', () => { const v = parseFloat(gridInp.value); if (!isNaN(v)) { store.update(d => { d.site.grid_m = Math.max(v / 100, MIN_SITE_GRID_M); }); redraw(); } });
    gridInp.addEventListener('change', () => { gridInp.value = String(Math.max(parseFloat(gridInp.value) || 0, MIN_SITE_GRID_M * 100)); });

    const settings = el('div', { class: 'site-settings' },
      unitToggle(tt('units.length'), [['m', tt('unit.m')], ['ft', tt('unit.ft')]], su,
        v => { store.update(d => { d.units.site.len = v; }); ctx.rerender(); }),
      el('label', { class: 'fld inline' }, el('span', { class: 'fld-l' }, `${tt('site.grid')} (cm)`), gridInp),
      el('label', { class: 'fld inline' }, el('span', { class: 'fld-l' }, `${tt('site.ladderwidth')} (${suTxt})`),
        lenInput(design.site.ladderWidth_m, su, v => { store.update(d => { d.site.ladderWidth_m = Math.max(v, MIN_LADDER_WIDTH_M); }); redraw(); }, { minSI: MIN_LADDER_WIDTH_M })),
      el('label', { class: 'fld inline', title: tt('site.refload.hint') }, el('span', { class: 'fld-l' }, `${tt('site.refload')} (kg)`),
        numInput(design.site.refLoad_kg || 120, 5, v => { store.update(d => { d.site.refLoad_kg = Math.max(v, 0); }); redraw(); renderPanel(); }, { min: 0 })),
      el('label', { class: 'fld inline', title: tt('site.soil.hint') }, el('span', { class: 'fld-l' }, tt('site.soil')),
        select([['soft', tt('site.soil.soft')], ['normal', tt('site.soil.normal')], ['firm', tt('site.soil.firm')]],
          design.site.soil || 'normal',
          v => { store.update(d => { d.site.soil = v; }); redraw(); renderPanel(); })));

    // Ctrl+Z / Ctrl+Y (eller Ctrl+Shift+Z) — kun aktiv mens kortet er fremme.
    if (tabSite._keyHandler) document.removeEventListener('keydown', tabSite._keyHandler);
    tabSite._keyHandler = e => {
      if (!mapBox.isConnected) { document.removeEventListener('keydown', tabSite._keyHandler); return; }
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName || '')) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); if (store.undo()) ctx.rerenderAll(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); if (store.redo()) ctx.rerenderAll(); }
    };
    document.addEventListener('keydown', tabSite._keyHandler);

    setHelp();
    redraw();
    renderPanel();
    if (tabSite.fitNext) { tabSite.fitNext = false; fit(); }   // tilpas zoom efter en forslags-rig
    const ladderCount = design.attachments.filter(a => a.type === 'ladder').length;
    const monkeyCount = design.attachments.filter(a => a.type === 'monkey').length;
    const avatarCount = design.attachments.filter(a => a.type === 'avatar').length;
    const countLabel = (n, oneKey, manyKey) => `${n} ${tt(n === 1 ? oneKey : manyKey)}`;
    const summary = el('div', { class: 'site-summary' },
      el('span', { class: 'summary-pill' }, `${design.posts.length} ${tt('site.posts.title')}`),
      el('span', { class: 'summary-pill' }, `${design.connections.length} ${tt('site.conn.tableTitle')}`),
      ...(ladderCount ? [el('span', { class: 'summary-pill' }, countLabel(ladderCount, 'site.summary.ladder.one', 'site.summary.ladder.many'))] : []),
      ...(monkeyCount ? [el('span', { class: 'summary-pill' }, countLabel(monkeyCount, 'site.summary.monkey.one', 'site.summary.monkey.many'))] : []),
      ...(avatarCount ? [el('span', { class: 'summary-pill' }, countLabel(avatarCount, 'site.summary.person.one', 'site.summary.person.many'))] : []));
    container.append(
      el('div', { class: 'page-head site-head' },
        el('div', {},
          el('h2', {}, tt('tab.site')),
          el('p', { class: 'intro' }, tt('site.intro'))),
        summary),
      el('div', { class: 'site-shell' },
        settings,
        el('div', { class: 'map-wrap' }, palette, mapBox, selPanel),
        help));
  },
};

function nextId(list, prefix) {
  let n = 0;
  for (const it of list) { const m = /(\d+)$/.exec(it.id || ''); if (m) n = Math.max(n, +m[1]); }
  return prefix + (n + 1);
}
