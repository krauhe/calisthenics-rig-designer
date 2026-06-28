// App-bootstrap: bygger header (sprog), fanebjælke, indhold og footer.

import * as store from './core/store.js';
import { t, LANGS } from './core/i18n.js';
import { el, clear } from './ui/dom.js';
import { tabPost } from './ui/tabPost.js';
import { tabBar } from './ui/tabBar.js';
import { placeholderTab } from './ui/tabs.js';

const TABS = [
  tabPost,
  tabBar,
  placeholderTab('site', 'tab.site'),
  placeholderTab('view3d', 'tab.view3d'),
  placeholderTab('materials', 'tab.materials'),
];

let active = 'post';

const lang = () => store.getDesign().settings.lang;
const ctx = () => ({ design: store.getDesign(), store, t, lang: lang(), rerender: renderActive });

function renderHeader() {
  const hd = clear(document.getElementById('hd'));
  hd.append(
    el('div', { class: 'brand' },
      el('strong', {}, t('app.title', lang())),
      el('span', { class: 'sub' }, t('app.subtitle', lang()))),
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
