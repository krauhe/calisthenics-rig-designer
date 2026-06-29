// Pladsholder-fane for funktioner der bygges i senere faser (kort, 3D, materialeliste).


function placeholderTab(id, labelKey, opts = {}) {
  return {
    id,
    labelKey,
    render(container, ctx) {
      const tt = k => ctx.t(k, ctx.lang);
      const soon = el('div', { class: 'soon' },
        el('div', { class: 'soon-badge' }, tt('soon.title')),
        el('p', {}, tt('soon.body')));
      if (opts.linkHref) {
        soon.append(el('p', {}, el('a', { href: opts.linkHref, class: 'classic-link' }, tt(opts.linkKey))));
      }
      container.append(el('h2', {}, tt(labelKey)), soon);
    },
  };
}
