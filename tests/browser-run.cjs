const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const root = path.resolve(__dirname, '..');
const out = process.env.RIG_TEST_ARTIFACTS || fs.mkdtempSync(path.join(os.tmpdir(), 'rig-browser-'));
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error, body) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(error ? 'not found' : body);
  });
});

async function main() {
  let browser;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    browser = await chromium.launch({ headless: true,
      ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await context.route('**/*', route => route.request().url().startsWith(base)
      || route.request().url().startsWith('data:') ? route.continue() : route.abort());
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', e => errors.push(e.message));
    async function fresh(preset = 'square4') {
      await page.goto(base);
      await page.evaluate(id => { store.replace(buildPreset(id)); tabSite.fitNext = true; setActive('site'); renderAll(); }, preset);
    }
    async function frames(p = page) {
      await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
    async function pixels(p = page) {
      return p.evaluate(() => {
        const canvas = document.querySelector('.view3d-host canvas');
        const gl = canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'));
        if (!gl) return 0;
        const data = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
        const colors = new Set();
        for (let i = 0; i < data.length; i += 64) colors.add(data[i] + ',' + data[i + 1] + ',' + data[i + 2]);
        return colors.size;
      });
    }
    await fresh();
    await page.locator('[data-tool="post"]').click();
    await page.locator('.map').hover({ position: { x: 150, y: 100 } });
    assert.deepEqual(errors, []);
    console.log('PASS post tool preview');

    await fresh();
    await page.locator('.connections-tab tbody tr').first().locator('.conn-name').click();
    assert.match(await page.locator('.map').innerText(), /Fri L 1,975 m/);
    console.log('PASS clear lengths on map and table');

    await fresh('pullup2');
    await page.evaluate(() => { const d = getDesign(); d.posts.forEach(p => { p.height_m = 1.3; }); d.connections = []; store.commit(); renderAll(); });
    await page.locator('[data-tool="connect"]').click();
    await page.locator('.map [data-el="post"]').nth(0).click();
    await page.locator('.map [data-el="post"]').nth(1).click();
    assert.deepEqual(await page.evaluate(() => [getDesign().connections[0].height_m,
      deserialize(serialize(getDesign())).connections[0].height_m]), [1.3, 1.3]);
    console.log('PASS new connections and reload use same height');

    await fresh();
    const savedBefore = await page.evaluate(() => { flushSave(); return localStorage.getItem(KEY); });
    const warning = page.waitForEvent('dialog');
    await page.locator('input[type=file]').setInputFiles({ name: 'not-a-design.json',
      mimeType: 'application/json', buffer: Buffer.from('{"shopping":["milk"]}') });
    await (await warning).dismiss();
    assert.equal(await page.evaluate(() => { flushSave(); return localStorage.getItem(KEY); }), savedBefore);
    console.log('PASS invalid file import preserves design and autosave');

    await fresh();
    // Defence in depth: even bypassing import validation must not turn IDs into markup.
    await page.evaluate(() => {
      getDesign().connections[0].id = 'probe"/><image href="/missing" onerror="window.__idInjected=true"/><line data-id="probe';
      renderAll();
    });
    assert.equal(await page.locator('.map image').count(), 0);
    assert.equal(await page.evaluate(() => window.__idInjected === true), false);
    console.log('PASS SVG attributes escape untrusted IDs');

    await fresh();
    await page.evaluate(() => {
      const d = getDesign();
      d.library.push({ id: 'review-pipe', name: '<img src="/missing" onerror="window.__printInjected=true">',
        kind: 'pipe', od: 33.7, wall: 3.2, E: 210e9, sRe: 195e6, sRm: 320e6 });
      d.connections[0].material = { source: 'library', id: 'review-pipe' };
      store.replace(deserialize(serialize(d))); window.print = () => {};
    });
    await page.evaluate(() => printGuide(ctx()));
    assert.equal(await page.locator('#print-root img:not(.pr-3d-img)').count(), 0);
    assert.equal(await page.evaluate(() => window.__printInjected === true), false);
    assert.ok((await page.locator('.pr-3d-img').getAttribute('src')).startsWith('data:image/png'));
    console.log('PASS print escapes material names and includes 3D');

    await fresh('pullup2');
    await page.evaluate(() => { getDesign().units.site.len = 'ft'; window.print = () => {}; });
    await page.evaluate(() => printGuide(ctx()));
    const printed = await page.evaluate(() => {
      const M = computeMaterials(getDesign()), id = Object.keys(M.cut).sort()[0], p = M.cut[id].pieces[0];
      return { text: document.querySelector('.pr-cut-list').textContent,
        expected: p.label + ' ' + fmt(lenFromSI(p.len, 'ft'), 2, 'da') + ' fod' };
    });
    assert.ok(printed.text.includes(printed.expected), JSON.stringify(printed));
    await page.pdf({ path: path.join(out, 'print-feet.pdf'), preferCSSPageSize: true, printBackground: true });
    console.log('PASS feet conversion in printed cut list');

    await fresh();
    await page.locator('.connections-tab tbody tr').first().locator('input').first().fill('2');
    await page.locator('.connections-tab tbody tr').first().locator('input').first().press('Tab');
    await page.locator('#tab-materials').click();
    const pipe = page.getByRole('spinbutton', { name: '1" rør: Gods (mm)', exact: true });
    await pipe.fill('2.6'); await pipe.press('Tab');
    assert.equal(await page.evaluate(() => resolveMaterial(getDesign(), 'pipe-1').wall), 2.6);
    assert.equal(await page.evaluate(() => connMatOf(getDesign(), getDesign().connections[0].material).wall), 2);
    await page.evaluate(() => { store.replace(deserialize(serialize(getDesign()))); renderAll(); });
    assert.equal(await pipe.inputValue(), '2.6');
    await page.getByRole('button', { name: '1" rør: Nulstil til standardgods', exact: true }).click();
    assert.equal(await pipe.inputValue(), '3.2');
    const kerf = page.locator('.cut-settings input');
    await kerf.click(); await kerf.press('Control+A'); await page.keyboard.type('2.6', { delay: 25 });
    assert.equal(await kerf.inputValue(), '2.6');
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.cut-settings input')), true);
    assert.equal(await page.evaluate(() => getDesign().site.cutKerf_mm), 2.6);
    console.log('PASS default walls, independent overrides, reset, reload and decimal typing');

    await fresh();
    await page.locator('#tab-materials').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-post');
    await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-bar');
    console.log('PASS keyboard access between tab groups');

    await fresh('long6');
    await page.evaluate(async () => {
      const d = getDesign(); d.posts[0].materialId = 'wood-85'; d.posts[1].materialId = 'pipe-1';
      const at = d.attachments.find(a => a.type === 'monkey');
      const a = d.connections.find(c => c.id === at.connA), b = d.connections.find(c => c.id === at.connB);
      a.height_m = a.desiredHeight_m = 2.4; b.height_m = b.desiredHeight_m = 2.2; store.commit();
      const T = await ensureThree();
      window.__rigTHREE = { ...T, WebGLRenderer: class extends T.WebGLRenderer {
        constructor(...args) { super(...args); const render = this.render;
          this.render = function(scene, camera) { window.__testScene = scene; window.__testCamera = camera; return render.call(this, scene, camera); };
        }
      } };
      setActive('view3d');
    });
    await page.waitForFunction(() => window.__testScene);
    const geometry = await page.evaluate(() => {
      const posts = []; window.__testScene.traverse(o => { if (o.name.startsWith('post:')) posts.push({ name: o.name, type: o.geometry.type, size: o.geometry.parameters }); });
      return posts;
    });
    assert.equal(geometry[0].size.width, 0.085);
    assert.equal(geometry[1].type, 'CylinderGeometry');
    assert.ok(Math.abs(geometry[1].size.radiusTop - 0.0337 / 2) < 1e-9);
    const rungError = await page.evaluate(() => {
      const d = getDesign(), at = d.attachments.find(a => a.type === 'monkey');
      const expected = monkeyGeometry(d, at.connA, at.connB).rungs[0];
      const rung = window.__testScene.getObjectByName('monkey:' + at.id);
      return Math.abs(rung.geometry.parameters.height - expected.len);
    });
    assert.ok(rungError < 1e-9);
    for (const [width, height] of [[1440, 1000], [390, 844]]) {
      await page.setViewportSize({ width, height }); await frames();
      assert.ok(await pixels() > 20, '3D canvas must contain rendered geometry');
      const before = await page.locator('.view3d-host canvas').screenshot();
      const box = await page.locator('.view3d-host canvas').boundingBox();
      await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
      await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.55, { steps: 8 }); await page.mouse.up();
      await frames();
      const framed = await page.evaluate(() => {
        const T = window.__rigTHREE, camera = window.__testCamera;
        let inside = true;
        window.__testScene.traverse(o => {
          if (!o.name.startsWith('post:')) return;
          const b = new T.Box3().setFromObject(o);
          for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
            const p = new T.Vector3(x, y, z).project(camera);
            if (Math.abs(p.x) > 0.98 || Math.abs(p.y) > 0.98) inside = false;
          }
        });
        return inside;
      });
      assert.equal(framed, true, 'all posts must fit after rotation/resizing');
      assert.equal(before.equals(await page.locator('.view3d-host canvas').screenshot()), false, 'rotation changes the canvas');
      await page.screenshot({ path: path.join(out, '3d-' + width + '.png'), fullPage: true });
    }
    console.log('PASS individual post geometry, sloped rung lengths and moving nonblank desktop/mobile 3D');

    for (const language of ['da', 'en']) {
      for (const width of [390, 768, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 }); await fresh('square4');
        await page.evaluate(code => setLang(code), language);
        await frames();
        const overflow = await page.evaluate(() => [...document.querySelectorAll('.conntable-area table')]
          .some(t => t.scrollWidth > document.querySelector('.conntable-area').clientWidth + 2));
        assert.equal(overflow, false, 'tables overflow at ' + width + ' / ' + language);
        const hiddenDelete = await page.evaluate(() => {
          const panel = document.querySelector('.conntable-area').getBoundingClientRect();
          return [...document.querySelectorAll('.row-delete')].some(b => {
            const r = b.getBoundingClientRect(); return r.right > panel.right + 1 || r.left < panel.left - 1;
          });
        });
        assert.equal(hiddenDelete, false, 'delete buttons must remain within panel');
        if (width === 390) await page.screenshot({ path: path.join(out, 'map-mobile-' + language + '.png'), fullPage: true });
      }
    }
    console.log('PASS responsive tables and visible delete actions in Danish/English');
    assert.deepEqual(errors, []);

    // Test the single file with no vendor directory nearby.
    const standalone = path.join(out, 'standalone.html');
    fs.copyFileSync(path.join(root, 'calisthenics-lokal.html'), standalone);
    for (const entry of [path.join(root, 'index.html'), standalone]) {
      const offline = await browser.newContext({ offline: true, serviceWorkers: 'block' });
      const p = await offline.newPage(), failures = [];
      p.on('pageerror', error => failures.push(error.message));
      await p.goto(pathToFileURL(entry).href);
      await p.evaluate(() => { store.replace(buildPreset('pullup2')); setActive('view3d'); });
      await p.waitForSelector('.view3d-host canvas');
      await frames(p);
      assert.ok(await pixels(p) > 20);
      assert.deepEqual(failures, []);
      await offline.close();
    }
    console.log('PASS fully offline local index and standalone 3D without vendor');
    console.log('Browser regression suite passed. Artifacts: ' + out);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
