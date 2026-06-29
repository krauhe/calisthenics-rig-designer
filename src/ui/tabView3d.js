// Fane: 3D. Viser dét, der er tegnet på Kort (stolper + forbindelser + stiger)
// i ægte 3D — bygget til at ligne den oprindelige enkelt-fil-app
// (chalestetics-3d.html): halvgennemsigtig jord så fundamentet ses (småsten,
// beton, tjære-zone), Kee-beslag på rørene, og en LODRET stige der binder sig
// til en vandret bar. Three.js hentes som ES-modul fra et CDN (kun når fanen
// åbnes) og lægges på window, så det passer ind i den klassiske
// script-arkitektur. Egen lille bane-styring bruges i stedet for OrbitControls
// (som ville kræve et importmap).

let _threeP = null;
function ensureThree() {
  if (window.__rigTHREE) return Promise.resolve(window.__rigTHREE);
  if (_threeP) return _threeP;
  _threeP = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.type = 'module';
    s.textContent =
      "import * as T from 'https://unpkg.com/three@0.160.0/build/three.module.js';" +
      "window.__rigTHREE = T; window.dispatchEvent(new Event('rig-three-ready'));";
    window.addEventListener('rig-three-ready', () => resolve(window.__rigTHREE), { once: true });
    s.addEventListener('error', () => reject(new Error('load')));
    document.head.appendChild(s);
    setTimeout(() => { if (!window.__rigTHREE) reject(new Error('timeout')); }, 20000);
  });
  return _threeP;
}

const tabView3d = {
  id: 'view3d',
  labelKey: 'tab.view3d',
  render(container, ctx) {
    const { design } = ctx;
    const tt = k => ctx.t(k, ctx.lang);

    container.append(el('h2', {}, tt('tab.view3d')), el('p', { class: 'intro' }, tt('view3d.intro')));

    if (!design.posts.length) {
      container.append(el('div', { class: 'soon' }, el('p', {}, tt('view3d.empty'))));
      return;
    }

    const host = el('div', { class: 'view3d-host' });
    const status = el('div', { class: 'view3d-status' }, tt('view3d.loading'));
    container.append(host, el('p', { class: 'view3d-hint' }, tt('view3d.hint')));
    host.append(status);

    ensureThree()
      .then(THREE => { status.remove(); build3d(THREE, host, design, ctx); })
      .catch(() => {
        clear(status);
        status.append(
          el('p', {}, tt('view3d.failed')),
          el('p', {}, el('a', { href: 'chalestetics-3d.html', class: 'classic-link' }, tt('view3d.classic'))));
      });
  },
};

function build3d(THREE, host, design, ctx) {
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const su = (design.units.site && design.units.site.len) || 'm';
  const lang = design.settings.lang;
  const suTxt = su === 'ft' ? ctx.t('unit.ft', lang) : ctx.t('unit.m', lang);

  // ---- faste fundament-mål (som i den oprindelige app) ----
  const DEPTH = (design.defaults.post && design.defaults.post.depth_m) || 1.2;
  const HOLE = ((design.defaults.post && design.defaults.post.hole_mm) || 300) / 1000;
  const GRAVEL_H = 0.10, TAR_BOTTOM = -0.5, TAR_TOP = 0.10;

  // ---- model-data ----
  const refLoad = design.site.refLoad_kg || 120;
  const cx = design.posts.reduce((s, p) => s + p.x_m, 0) / design.posts.length;
  const cz = design.posts.reduce((s, p) => s + p.z_m, 0) / design.posts.length;
  const byId = Object.fromEntries(design.posts.map(p => [p.id, p]));
  const pm = resolveMaterial(design, design.defaults.post.materialId);
  const POST = ((pm && (pm.side || pm.od)) || 125) / 1000;
  const connMat = ref => { const id = ref && ref.source === 'library' ? ref.id : ref; return design.library.find(m => m.id === id) || design.library[0]; };
  const maxConnH = design.connections.reduce((m, c) => Math.max(m, c.height_m), 0) || (design.site.connHeight_m || 2.2);
  const POST_ABOVE = Math.max(maxConnH + 0.15, 2.0);   // ensartet stolpehøjde over jord

  // ---- scene + renderer ----
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe6ee);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);

  // ---- lys ----
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7a86, 0.85));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
  sun.position.set(6, 10, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sb = 7; sun.shadow.camera.left = -sb; sun.shadow.camera.right = sb; sun.shadow.camera.top = sb; sun.shadow.camera.bottom = -sb;
  scene.add(sun);

  // ---- materialer (samme paletter som den oprindelige) ----
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xb6c089, roughness: 0.9 });
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.4, metalness: 0.7 });
  const galvMat = new THREE.MeshStandardMaterial({ color: 0xb9c0c6, roughness: 0.35, metalness: 0.85 });
  const tarMat = new THREE.MeshStandardMaterial({ color: 0x14110f, roughness: 0.55 });
  const concMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 1, transparent: true, opacity: 0.55 });
  const gravelMat = new THREE.MeshStandardMaterial({ color: 0x7d8389, roughness: 1 });
  const critMat = new THREE.MeshStandardMaterial({ color: 0xd0241c, roughness: 0.45, metalness: 0.3 });

  // ---- geometri-hjælpere ----
  function cylBetween(a, b, r, mat) {
    const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 16), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.clone().normalize());
    m.castShadow = true;
    return m;
  }
  // Kee-beslag (forenklet): rund flange mod stolpen + muffe om røret + sætskrue.
  function makeFitting(r) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 24), galvMat);
    base.rotation.z = Math.PI / 2; base.position.x = 0.006; base.castShadow = true; g.add(base);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.35, r * 1.35, 0.06, 20), galvMat);
    sleeve.rotation.z = Math.PI / 2; sleeve.position.x = 0.045; sleeve.castShadow = true; g.add(sleeve);
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, r * 1.6, 10), galvMat);
    screw.position.set(0.045, r * 1.5, 0); g.add(screw);
    return g;
  }
  function makeClamp(r) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.5, r * 1.5, 0.05, 16), galvMat);
    m.castShadow = true; return m;
  }
  // fast flad label på jorden (ligger fladt, følger IKKE kameraet)
  function makeFlatLabel(text) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    c.width = 128; c.height = 128;
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
    g.lineWidth = 7; g.strokeStyle = '#0b66c3'; g.stroke();
    g.fillStyle = '#0b3a66'; g.font = 'bold 76px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 64, 70);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    plane.rotation.x = -Math.PI / 2;
    const grp = new THREE.Group(); grp.add(plane); return grp;
  }
  // svævende højde-label (canvas-sprite, vender mod kameraet)
  function makeLabel(text) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    c.width = 256; c.height = 72;
    g.fillStyle = 'rgba(11,102,195,0.92)';
    g.beginPath(); const r = 14, w = 248, h = 64, x = 4, y = 4;
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 38px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 40);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    spr.scale.set(0.6, 0.17, 1);
    return spr;
  }
  const fmtH = h => `${fmt(lenFromSI(h, su), su === 'ft' ? 1 : 1, lang)} ${suTxt}`;

  const group = new THREE.Group(); scene.add(group);
  let maxR = 1;

  // ---- stolper + fundament ----
  for (const p of design.posts) {
    const X = p.x_m - cx, Z = p.z_m - cz;
    maxR = Math.max(maxR, Math.hypot(X, Z));
    const total = POST_ABOVE + DEPTH;
    const post = new THREE.Mesh(new THREE.BoxGeometry(POST, total, POST), woodMat);
    post.position.set(X, (POST_ABOVE - DEPTH) / 2, Z); post.castShadow = true; post.receiveShadow = true; group.add(post);

    const gravel = new THREE.Mesh(new THREE.BoxGeometry(HOLE, GRAVEL_H, HOLE), gravelMat);
    gravel.position.set(X, -DEPTH + GRAVEL_H / 2, Z); group.add(gravel);

    const concH = Math.max(0.01, DEPTH - GRAVEL_H);
    const conc = new THREE.Mesh(new THREE.BoxGeometry(HOLE, concH, HOLE), concMat);
    conc.position.set(X, -DEPTH + GRAVEL_H + concH / 2, Z); group.add(conc);

    const tarBot = Math.max(TAR_BOTTOM, -DEPTH), tarH = TAR_TOP - tarBot;
    const tar = new THREE.Mesh(new THREE.BoxGeometry(POST * 1.06, tarH, POST * 1.06), tarMat);
    tar.position.set(X, (tarBot + TAR_TOP) / 2, Z); group.add(tar);
    const tarTop = new THREE.Mesh(new THREE.BoxGeometry(POST * 1.02, 0.02, POST * 1.02), tarMat);
    tarTop.position.set(X, POST_ABOVE + 0.01, Z); tarTop.castShadow = true; group.add(tarTop);
  }

  // ---- forbindelser (bars) + beslag ----
  design.connections.forEach((c, idx) => {
    const a = byId[c.a], b = byId[c.b]; if (!a || !b) return;
    const A = V3(a.x_m - cx, c.height_m, a.z_m - cz);
    const B = V3(b.x_m - cx, c.height_m, b.z_m - cz);
    const span = Math.hypot(b.x_m - a.x_m, b.z_m - a.z_m);
    const mat = connMat(c.material);
    const crit = span > 0 && beam(span, mat, 1, 0.25).pYield < refLoad;
    const baseMat = crit ? critMat : (mat.kind === 'wood' ? woodMat : pipeMat);
    if (mat.kind === 'wood') {
      const sd = (mat.side || 100) / 1000;
      const dir = new THREE.Vector3().subVectors(B, A); const len = dir.length();
      const m = new THREE.Mesh(new THREE.BoxGeometry(sd, sd, len), baseMat);
      m.position.copy(A).addScaledVector(dir, 0.5);
      m.quaternion.setFromUnitVectors(V3(0, 0, 1), dir.clone().normalize());
      m.castShadow = true; group.add(m);
    } else {
      const r = (mat.od || 33) / 2000;
      group.add(cylBetween(A, B, r, baseMat));
      // Kee-beslag i begge ender (mod stolperne)
      [[A, B], [B, A]].forEach(([end, other]) => {
        const f = makeFitting(r);
        const toMid = new THREE.Vector3().subVectors(other, end).setY(0).normalize();
        f.position.set(end.x + toMid.x * POST / 2, c.height_m, end.z + toMid.z * POST / 2);
        f.quaternion.setFromUnitVectors(V3(1, 0, 0), toMid);
        group.add(f);
      });
    }
    // svævende højde-label ved baren
    const out = new THREE.Vector3((A.x + B.x) / 2, 0, (A.z + B.z) / 2);
    if (out.length() > 1e-3) out.normalize(); else out.set(0, 0, 1);
    const hl = makeLabel(fmtH(c.height_m));
    hl.position.set((A.x + B.x) / 2 + out.x * 0.3, c.height_m + 0.16, (A.z + B.z) / 2 + out.z * 0.3);
    group.add(hl);
    // fast bogstav-label på jorden (som i den oprindelige version)
    const fl = makeFlatLabel(letterFor(idx));
    fl.position.set((A.x + B.x) / 2, 0.02, (A.z + B.z) / 2);
    fl.rotation.y = Math.atan2(out.x, out.z);
    group.add(fl);
  });

  // ---- stiger: LODRET rør + vandrette trin, bundet til en vandret bar ----
  function ladderBar(at) {
    const conns = design.connections.filter(c => c.a === at.postId || c.b === at.postId);
    const p = byId[at.postId]; if (!conns.length || !p) return null;
    const dirTo = c => { const o = byId[c.a === at.postId ? c.b : c.a]; return Math.atan2(o.z_m - p.z_m, o.x_m - p.x_m); };
    let best = conns[0];
    if (at.angle_rad == null) { for (const c of conns) if (c.height_m > best.height_m) best = c; }
    else { let bd = Infinity; for (const c of conns) { const d = dirTo(c); const diff = Math.abs(((d - at.angle_rad + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI); if (diff < bd) { bd = diff; best = c; } } }
    const ang = dirTo(best);
    return { height: best.height_m, dx: Math.cos(ang), dz: Math.sin(ang) };
  }

  for (const at of design.attachments) {
    if (at.type !== 'ladder') continue;
    const p = byId[at.postId]; if (!p) continue;
    const X = p.x_m - cx, Z = p.z_m - cz;
    const bar = ladderBar(at);
    const dx = bar ? bar.dx : 0, dz = bar ? bar.dz : 1;
    const barY = bar ? bar.height : (design.site.connHeight_m || 2.2);
    const inset = at.width_m || 0.5;           // afstand stolpe → lodret rør
    const rLad = (33.7 / 1000) / 2;            // 1" stigerør
    const vBot = -0.5;                         // nedstøbt ½ m
    const vx = X + dx * inset, vz = Z + dz * inset;

    // betonfod + småsten til det lodrette rør
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5 - GRAVEL_H, 0.22), concMat);
    foot.position.set(vx, -0.25 + GRAVEL_H / 2, vz); group.add(foot);
    const footG = new THREE.Mesh(new THREE.BoxGeometry(0.22, GRAVEL_H, 0.22), gravelMat);
    footG.position.set(vx, -0.5 + GRAVEL_H / 2, vz); group.add(footG);

    // lodret rør op til baren
    group.add(cylBetween(V3(vx, vBot, vz), V3(vx, barY, vz), rLad, pipeMat));
    // quick-fitting hvor det lodrette rør møder baren
    const qf = makeClamp(rLad); qf.position.set(vx, barY, vz); group.add(qf);

    // trin hver 40 cm
    for (let y = 0.4; y <= barY - 0.25; y += 0.4) {
      const px = X + dx * POST / 2, pz = Z + dz * POST / 2;
      group.add(cylBetween(V3(px, y, pz), V3(vx, y, vz), rLad, pipeMat));
      const fp = makeFitting(rLad); fp.position.set(px, y, pz);
      fp.quaternion.setFromUnitVectors(V3(1, 0, 0), V3(dx, 0, dz)); group.add(fp);
      const cv = makeClamp(rLad); cv.position.set(vx, y, vz); group.add(cv);
    }
  }

  // ---- halvgennemsigtig jord + gitter (så fundamentet ses) ----
  const gsize = Math.max(8, maxR * 2.8);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(gsize, gsize),
    new THREE.MeshStandardMaterial({ color: 0x9fb18f, roughness: 1, transparent: true, opacity: 0.68, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const grid = new THREE.GridHelper(gsize, Math.round(gsize), 0x7a8a72, 0x88977f);
  grid.position.y = 0.001; scene.add(grid);

  // ---- bane-styret kamera (rotér / zoom / panorér) ----
  const target = V3(0, POST_ABOVE * 0.45, 0);
  const orbit = { r: Math.max(maxR * 2.4, POST_ABOVE * 1.9, 4), theta: Math.PI * 0.25, phi: Math.PI * 0.36 };
  function applyCam() {
    const sp = Math.sin(orbit.phi);
    camera.position.set(
      target.x + orbit.r * sp * Math.sin(orbit.theta),
      target.y + orbit.r * Math.cos(orbit.phi),
      target.z + orbit.r * sp * Math.cos(orbit.theta));
    camera.lookAt(target);
  }
  applyCam();

  const cvs = renderer.domElement;
  cvs.style.cursor = 'grab';
  cvs.style.touchAction = 'none';
  let drag = null;
  cvs.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey };
    cvs.style.cursor = 'grabbing';
    try { cvs.setPointerCapture(e.pointerId); } catch (_) {}
  });
  cvs.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (drag.pan) {
      const right = V3().subVectors(camera.position, target); right.y = 0; right.normalize();
      const side = V3(-right.z, 0, right.x);
      const k = orbit.r * 0.0016;
      target.addScaledVector(side, -dx * k); target.y = Math.max(0, target.y + dy * k);
    } else {
      orbit.theta -= dx * 0.01;
      orbit.phi = Math.min(Math.PI * 0.49, Math.max(0.08, orbit.phi - dy * 0.01));
    }
    applyCam();
  });
  const endDrag = () => { drag = null; cvs.style.cursor = 'grab'; };
  cvs.addEventListener('pointerup', endDrag);
  cvs.addEventListener('pointercancel', endDrag);
  cvs.addEventListener('contextmenu', e => e.preventDefault());
  cvs.addEventListener('wheel', e => {
    e.preventDefault();
    orbit.r = Math.min(maxR * 8 + 20, Math.max(1.2, orbit.r * (e.deltaY < 0 ? 1 / 1.1 : 1.1)));
    applyCam();
  }, { passive: false });

  // ---- render-loop (stopper når lærredet fjernes fra DOM) ----
  let lastW = 0, lastH = 0;
  function frame() {
    if (!host.isConnected) { renderer.dispose(); return; }
    const w = host.clientWidth || 1, h = host.clientHeight || Math.round(w * 0.62);
    if (w !== lastW || h !== lastH) {
      lastW = w; lastH = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
}
