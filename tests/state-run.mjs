import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const core = ['constants', 'units', 'sections', 'mechanics', 'foundation',
  'cutplan', 'materials', 'model', 'presets', 'schema', 'store'];
let now = 10000;
const saved = new Map(), input = { matches: () => true };
const document = { activeElement: null };
const ctx = vm.createContext({ console, document, Date: { now: () => now },
  localStorage: { getItem: k => saved.get(k), setItem: (k, v) => saved.set(k, v) },
  setTimeout: () => 1, clearTimeout: () => {} });
vm.runInContext(core.map(f => read('src/core/' + f + '.js')).join('\n'), ctx);
const run = code => vm.runInContext(code, ctx);
run("replace(buildPreset('square4'))");
now += 1000;
run('update(d => { d.posts[0].height_m = 2; })');
now += 100;
run("update(d => applyDeletion(d, deletionPlan(d, 'post', d.posts[1].id)))");
assert.equal(run('undo()'), true);
assert.equal(run('getDesign().posts.length'), 4);
assert.equal(run('getDesign().posts[0].height_m'), 2);
assert.equal(run('redo()'), true);
assert.equal(run('getDesign().posts.length'), 3);
run('undo()');
document.activeElement = input; now += 1000;
run("update(d => { d.meta.name = 'A'; })"); now += 100;
run("update(d => { d.meta.name = 'AB'; })");
run('undo()');
assert.notEqual(run('getDesign().meta.name'), 'A');
assert.notEqual(run('getDesign().meta.name'), 'AB');
run('redo()');
assert.equal(run('getDesign().meta.name'), 'AB');
run('flushSave()');
assert.equal(JSON.parse(saved.get('calisthenics-rig-designer')).meta.name, 'AB');
console.log('PASS history: independent actions, text coalescing, redo and autosave');

const handlers = {}, deleted = [];
let activation;
const sw = vm.createContext({
  self: { addEventListener: (key, handler) => { handlers[key] = handler; },
    clients: { claim: () => {} }, skipWaiting: () => {} },
  caches: { keys: async () => ['other-app-v1', 'rig-cache-v1', 'rig-cache-v2', 'rig-cache-v3'],
    delete: async key => { deleted.push(key); } }
});
vm.runInContext(read('sw.js'), sw);
handlers.activate({ waitUntil: promise => { activation = promise; } });
await activation;
assert.deepEqual(deleted.sort(), ['rig-cache-v1', 'rig-cache-v2']);
console.log('PASS service worker leaves unrelated caches intact');

const index = read('index.html'), bundled = read('calisthenics-lokal.html');
const files = [...index.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
files.forEach(file => new vm.Script(read(file), { filename: file }));
const source = files.map(file => '// ===== ' + file + ' =====\n' + read(file).replace(/\r\n/g, '\n')).join('\n\n');
const inline = bundled.slice(bundled.indexOf('<script>') + 8, bundled.lastIndexOf('</script>')).replace(/\r\n/g, '\n').trim();
assert.equal(inline, source.trim());
new vm.Script(inline);
console.log('PASS generated bundle matches source and parses');
const locales = vm.createContext({});
vm.runInContext(read('src/core/locales/da.js') + '\n' + read('src/core/locales/en.js'), locales);
assert.equal(vm.runInContext('JSON.stringify(Object.keys(da).sort()) === JSON.stringify(Object.keys(en).sort())', locales), true);
console.log('PASS translation key parity');
