// App-bootstrap: bygger header (sprog), fanebjælke, indhold og footer.

// Saml store-funktionerne i ét objekt (virker både som ES-modul og i enkelt-fil-bundlen).
const store = { getDesign, commit, update, replace, undo, redo };

const TABS = [
  tabSite,
  tabView3d,
  tabMaterials,
  tabPost,
  tabBar,
];
const TAB_GROUPS = [
  { labelKey: 'nav.project', tabs: [tabSite, tabView3d, tabMaterials] },
  { labelKey: 'nav.analysis', tabs: [tabPost, tabBar] },
];

const ACTIVE_KEY = 'crd-active-tab';
let active = (() => {
  try { const s = localStorage.getItem(ACTIVE_KEY); if (s && TABS.some(t => t.id === s)) return s; } catch (_) {}
  return 'site';
})();

const lang = () => store.getDesign().settings.lang;
const ctx = () => ({ design: store.getDesign(), store, t, lang: lang(), rerender: renderActive, rerenderAll: renderAll, openTab: setActive });

function renderHeader() {
  const hd = clear(document.getElementById('hd'));
  hd.append(
    el('div', { class: 'brand' },
      el('strong', {}, t('app.title', lang()))),
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
  TAB_GROUPS.forEach(group => {
    const wrap = el('div', { class: 'tab-group' + (group.labelKey ? ' tab-group-labeled' : '') });
    if (group.labelKey) wrap.append(el('span', { class: 'tab-group-label' }, t(group.labelKey, lang())));
    const rowTabs = el('div', { class: 'tab-row' });
    group.tabs.forEach(tab => rowTabs.append(
      el('button', {
        class: 'tab' + (tab.id === active ? ' on' : ''),
        type: 'button',
        onclick: () => setActive(tab.id),
      }, t(tab.labelKey, lang()))));
    wrap.append(rowTabs);
    nav.append(wrap);
  });
}

function renderActive() {
  const c = clear(document.getElementById('content'));
  const tab = TABS.find(x => x.id === active) || TABS[0];   // ukendt fane-id → fald pænt tilbage
  active = tab.id;
  c.className = 'view-' + tab.id;
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
