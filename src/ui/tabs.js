// Pladsholder-fane for funktioner der bygges i senere faser (kort, 3D, materialeliste).

import { el } from './dom.js';

export function placeholderTab(id, labelKey) {
  return {
    id,
    labelKey,
    render(container, ctx) {
      const tt = k => ctx.t(k, ctx.lang);
      container.append(
        el('h2', {}, tt(labelKey)),
        el('div', { class: 'soon' },
          el('div', { class: 'soon-badge' }, tt('soon.title')),
          el('p', {}, tt('soon.body'))));
    },
  };
}
