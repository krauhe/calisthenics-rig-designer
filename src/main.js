// App-bootstrap: bygger header (sprog), fanebjælke, indhold og footer.

// Saml store-funktionerne i ét objekt (virker både som ES-modul og i enkelt-fil-bundlen).
const store = { getDesign, subscribe, commit, update, replace, addMaterial, removeMaterial };

const TABS = [
  tabPost,
  tabBar,
  tabSite,
  tabView3d,
  tabMaterials,
];

const ACTIVE_KEY = 'crd-active-tab';
let active = (() => {
  try { const s = localStorage.getItem(ACTIVE_KEY); if (s && TABS.some(t => t.id === s)) return s; } catch (_) {}
  return 'post';
})();

const lang = () => store.getDesign().settings.lang;
const ctx = () => ({ design: store.getDesign(), store, t, lang: lang(), rerender: renderActive, rerenderAll: renderAll });

function renderHeader() {
  const hd = clear(document.getElementById('hd'));
  hd.append(
    el('div', { class: 'brand' },
      el('strong', {}, t('app.title', lang())),
      el('span', { class: 'sub' }, t('app.subtitle', lang()))),
    fileBar(ctx()),
    el('div', { class: 'lang' },
      el('span', { class: 'lang-l' }, t('lang.label', lang())),
      ...LANGS.map(([code, name]) =>
        el('button', {
          class: 'lang-b' + (code === lang() ? ' on' : ''),
          type: 'button',
          onclick: () => setLang(code),
        }, name))));
}

function renderTabbar() {
  const nav = clear(document.getElementById('tabbar'));
  TABS.forEach(tab => nav.append(
    el('button', {
      class: 'tab' + (tab.id === active ? ' on' : ''),
      type: 'button',
      onclick: () => setActive(tab.id),
    }, t(tab.labelKey, lang()))));
}

function renderActive() {
  const c = clear(document.getElementById('content'));
  const tab = TABS.find(x => x.id === active);
  tab.render(c, ctx());
}

function renderFooter() {
  document.getElementById('ft').textContent = t('disclaimer', lang());
}

function setLang(code) {
  store.update(d => { d.settings.lang = code; });
  document.documentElement.lang = code;
  renderAll();
}

function setActive(id) {
  active = id;
  try { localStorage.setItem(ACTIVE_KEY, id); } catch (_) {}
  renderTabbar();
  renderActive();
}

function renderAll() {
  renderHeader();
  renderTabbar();
  renderActive();
  renderFooter();
}

document.documentElement.lang = lang();
renderAll();
