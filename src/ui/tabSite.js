// Fane: Kort (top-ned) — et lille tegneprogram for stativets grundplan.
// Værktøjspalette i venstre side, gitter med justerbar opløsning (default =
// stolpetykkelse), snapping, pan/zoom, og placering af stolper, forbindelser
// og stiger direkte i graf-modellen (design.posts/connections/attachments).


const W = 520, H = 440;                 // SVG bruger-koordinater (viewBox)
const MIN_K = 12, MAX_K = 400;          // zoom-grænser (px pr. meter)

// Vedvarende editor-tilstand på tværs af re-renders:
let tool = 'select';
let selectedPost = null;
let connectFrom = null;
let view = null;                        // { k, tx, ty }

const TOOLS = [
  ['select', '🖱', 'tool.select'],
  ['post', '▪', 'tool.post'],
  ['connect', '／', 'tool.connect'],
  ['ladder', '🪜', 'tool.ladder'],
  ['delete', '🗑', 'tool.delete'],
];

const tabSite = {
  id: 'site',
  labelKey: 'tab.site',
  render(container, ctx) {
    const { design, store, lang } = ctx;
    const tt = k => ctx.t(k, lang);
    if (!view) view = { k: 70, tx: W / 2, ty: H * 0.6 };

    const mapBox = el('div', { class: 'map' });   // container; vi indsætter et helt <svg> via innerHTML
    const help = el('div', { class: 'map-help' });

    // ---- koordinat-transform ----
    const toScreen = (wx, wz) => [wx * view.k + view.tx, wz * view.k + view.ty];
    const toWorld = (sx, sy) => [(sx - view.tx) / view.k, (sy - view.ty) / view.k];
    const snap = w => { const g = design.site.grid_m || 0.125; return Math.round(w / g) * g; };
    const evtToUser = e => {
      const r = mapBox.getBoundingClientRect();
      return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)];
    };

    const postSideM = () => {
      const m = resolveMaterial(design, design.defaults.post.materialId);
      return (m.kind === 'wood' ? m.side : m.od) / 1000;
    };
    const connMat = ref => {
      const id = ref && ref.source === 'library' ? ref.id : ref;
      return design.library.find(m => m.id === id) || design.library[0];
    };
    const colorOf = ref => {
      const i = design.library.findIndex(m => m.id === (ref && ref.id));
      return COLORS[(i < 0 ? 0 : i) % COLORS.length];
    };

    function setHelp() { help.textContent = tt('site.help.' + tool); }

    // ---- tegn scenen ----
    function redraw() {
      const g = design.site.grid_m || 0.125;
      const [minWx, minWz] = toWorld(0, 0), [maxWx, maxWz] = toWorld(W, H);
      let step = g; while (step * view.k < 7) step *= 2;     // undgå for tætte linjer

      let grid = '';
      for (let x = Math.ceil(minWx / step) * step; x <= maxWx; x += step) {
        const [sx] = toScreen(x, 0);
        const axis = Math.abs(x) < 1e-9;
        grid += `<line x1="${sx.toFixed(1)}" y1="0" x2="${sx.toFixed(1)}" y2="${H}" stroke="${axis ? '#b7c2cd' : '#e7ecf1'}" stroke-width="${axis ? 1.2 : 1}"/>`;
      }
      for (let z = Math.ceil(minWz / step) * step; z <= maxWz; z += step) {
        const [, sy] = toScreen(0, z);
        const axis = Math.abs(z) < 1e-9;
        grid += `<line x1="0" y1="${sy.toFixed(1)}" x2="${W}" y2="${sy.toFixed(1)}" stroke="${axis ? '#b7c2cd' : '#e7ecf1'}" stroke-width="${axis ? 1.2 : 1}"/>`;
      }

      const byId = Object.fromEntries(design.posts.map(p => [p.id, p]));
      let conns = '';
      for (const c of design.connections) {
        const a = byId[c.a], b = byId[c.b]; if (!a || !b) continue;
        const [ax, ay] = toScreen(a.x_m, a.z_m), [bx, by] = toScreen(b.x_m, b.z_m);
        conns += `<line data-el="conn" data-id="${c.id}" x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${colorOf(c.material)}" stroke-width="4" stroke-linecap="round"/>`;
      }

      const side = Math.max(7, postSideM() * view.k);
      let posts = '';
      for (const p of design.posts) {
        const [sx, sy] = toScreen(p.x_m, p.z_m);
        const sel = p.id === selectedPost || p.id === connectFrom;
        posts += `<rect data-el="post" data-id="${p.id}" x="${(sx - side / 2).toFixed(1)}" y="${(sy - side / 2).toFixed(1)}" width="${side.toFixed(1)}" height="${side.toFixed(1)}" rx="2" fill="#b6986a" stroke="${sel ? '#0b66c3' : '#6b4f2a'}" stroke-width="${sel ? 2.5 : 1.2}"/>`;
      }

      let ladders = '';
      for (const at of design.attachments) {
        if (at.type !== 'ladder') continue;
        const p = byId[at.postId]; if (!p) continue;
        const [sx, sy] = toScreen(p.x_m, p.z_m);
        ladders += `<g data-el="ladder" data-id="${at.id}" transform="translate(${(sx + side / 2 + 3).toFixed(1)},${(sy - 7).toFixed(1)})">
          <rect x="0" y="0" width="12" height="14" rx="2" fill="#fff" stroke="#0e7490"/>
          <line x1="3" y1="0" x2="3" y2="14" stroke="#0e7490"/><line x1="9" y1="0" x2="9" y2="14" stroke="#0e7490"/>
          <line x1="3" y1="4" x2="9" y2="4" stroke="#0e7490"/><line x1="3" y1="9" x2="9" y2="9" stroke="#0e7490"/></g>`;
      }

      const empty = design.posts.length === 0
        ? `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="13" fill="#9aa6b2">${tt('site.empty')}</text>` : '';

      mapBox.innerHTML =
        `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:100%">` +
        `<rect data-el="bg" x="0" y="0" width="${W}" height="${H}" fill="transparent"/>` +
        grid + conns + ladders + posts + empty +
        `</svg>`;
    }

    // ---- interaktion ----
    let drag = null;   // { mode:'pan'|'move', id?, startUx, startUy, startTx, startTy, moved }

    mapBox.addEventListener('pointerdown', e => {
      const [ux, uy] = evtToUser(e);
      const t = e.target.closest('[data-el]');
      const kind = t && t.getAttribute('data-el');
      const id = t && t.getAttribute('data-id');
      if (tool === 'select' && kind === 'post') {
        drag = { mode: 'move', id, startUx: ux, startUy: uy, moved: false };
        mapBox.setPointerCapture(e.pointerId);
      } else if (tool === 'select') {
        drag = { mode: 'pan', startUx: ux, startUy: uy, startTx: view.tx, startTy: view.ty, moved: false };
        mapBox.setPointerCapture(e.pointerId);
      }
    });

    mapBox.addEventListener('pointermove', e => {
      if (!drag) return;
      const [ux, uy] = evtToUser(e);
      if (Math.hypot(ux - drag.startUx, uy - drag.startUy) > 3) drag.moved = true;
      if (drag.mode === 'pan') {
        view.tx = drag.startTx + (ux - drag.startUx);
        view.ty = drag.startTy + (uy - drag.startUy);
        redraw();
      } else if (drag.mode === 'move') {
        const p = design.posts.find(x => x.id === drag.id); if (!p) return;
        const [wx, wz] = toWorld(ux, uy);
        p.x_m = snap(wx); p.z_m = snap(wz);
        redraw();
      }
    });

    mapBox.addEventListener('pointerup', e => {
      const wasDrag = drag && drag.moved;
      if (drag && drag.mode === 'move' && drag.moved) store.commit();   // gem flytning
      drag = null;
      if (wasDrag) return;                 // det var et træk, ikke et klik
      handleClick(e);
    });

    function handleClick(e) {
      const [ux, uy] = evtToUser(e);
      const t = e.target.closest('[data-el]');
      const kind = t && t.getAttribute('data-el');
      const id = t && t.getAttribute('data-id');

      if (tool === 'post' && (kind === 'bg' || !t)) {
        const [wx, wz] = toWorld(ux, uy);
        store.update(d => d.posts.push({ id: nextId(d.posts, 'p'), x_m: snap(wx), z_m: snap(wz), override: null }));
        redraw();
      } else if (tool === 'select') {
        selectedPost = kind === 'post' ? id : null; redraw();
      } else if (tool === 'connect' && kind === 'post') {
        if (!connectFrom) { connectFrom = id; }
        else if (connectFrom !== id) {
          const a = connectFrom, b = id;
          const exists = design.connections.some(c => (c.a === a && c.b === b) || (c.a === b && c.b === a));
          if (!exists) store.update(d => d.connections.push({
            id: nextId(d.connections, 'c'), a, b,
            height_m: d.site.connHeight_m,
            material: { source: 'library', id: d.site.connMaterialId },
            onTop: false,
          }));
          connectFrom = null;
        }
        redraw();
      } else if (tool === 'ladder' && kind === 'post') {
        store.update(d => d.attachments.push({ id: nextId(d.attachments, 'a'), type: 'ladder', postId: id, width_m: d.site.ladderWidth_m }));
        redraw();
      } else if (tool === 'delete') {
        if (kind === 'post') store.update(d => {
          d.posts = d.posts.filter(p => p.id !== id);
          d.connections = d.connections.filter(c => c.a !== id && c.b !== id);
          d.attachments = d.attachments.filter(at => at.postId !== id);
        });
        else if (kind === 'conn') store.update(d => {
          d.connections = d.connections.filter(c => c.id !== id);
          d.attachments = d.attachments.filter(at => at.connectionId !== id);
        });
        else if (kind === 'ladder') store.update(d => { d.attachments = d.attachments.filter(at => at.id !== id); });
        if (selectedPost && !design.posts.some(p => p.id === selectedPost)) selectedPost = null;
        redraw();
      }
    }

    mapBox.addEventListener('wheel', e => {
      e.preventDefault();
      const [ux, uy] = evtToUser(e);
      const [wx, wz] = toWorld(ux, uy);
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      view.k = Math.min(MAX_K, Math.max(MIN_K, view.k * factor));
      // hold punktet under markøren fast
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

    // ---- palette + indstillinger ----
    const palette = el('div', { class: 'toolpalette' },
      ...TOOLS.map(([id, icon, key]) =>
        el('button', { class: 'toolbtn' + (tool === id ? ' on' : ''), type: 'button', title: tt(key), 'data-tool': id,
          onclick: () => { tool = id; connectFrom = null; selectedPost = null; setHelp();
            palette.querySelectorAll('.toolbtn').forEach(b => b.classList.toggle('on', b.getAttribute('data-tool') === id));
            redraw(); } },
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
      el('label', { class: 'fld inline' }, el('span', { class: 'fld-l' }, `${tt('site.grid')} (cm)`), gridInp, presets),
      el('label', { class: 'fld inline' }, el('span', { class: 'fld-l' }, tt('site.connmat')),
        select(design.library.map(m => [m.id, m.name]), design.site.connMaterialId,
          v => { store.update(d => { d.site.connMaterialId = v; }); redraw(); })),
      el('label', { class: 'fld inline' }, el('span', { class: 'fld-l' }, `${tt('site.connheight')} (m)`),
        lenInput(design.site.connHeight_m, 'm', v => store.update(d => { d.site.connHeight_m = v; }))),
      el('label', { class: 'fld inline' }, el('span', { class: 'fld-l' }, `${tt('site.ladderwidth')} (m)`),
        lenInput(design.site.ladderWidth_m, 'm', v => store.update(d => { d.site.ladderWidth_m = v; }))));

    setHelp();
    redraw();
    container.append(
      el('h2', {}, tt('tab.site')),
      el('p', { class: 'intro' }, tt('site.intro')),
      settings,
      el('div', { class: 'map-wrap' }, palette, mapBox),
      help);
  },
};

function nextId(list, prefix) {
  let n = 0;
  for (const it of list) { const m = /(\d+)$/.exec(it.id || ''); if (m) n = Math.max(n, +m[1]); }
  return prefix + (n + 1);
}
