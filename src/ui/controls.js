// Genbrugelige input-kontroller, inkl. enheds-bevidste felter.
// Number-inputs bruger altid '.' som decimaltegn (krav for <input type=number>);
// dansk komma bruges kun i visningstekst (resultater), ikke i input.


const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

// En etiketteret felt-række.
function field(labelText, control, hint) {
  return el('label', { class: 'fld' },
    el('span', { class: 'fld-l' }, labelText),
    control,
    hint ? el('span', { class: 'fld-h' }, hint) : null);
}

// Rå talinput.
function numInput(value, step, onValue) {
  const inp = el('input', { type: 'number', step: String(step), value: String(value) });
  inp.addEventListener('input', () => {
    const v = parseFloat(inp.value);
    if (!isNaN(v)) onValue(v);
  });
  return inp;
}

// Længde-input: gemmer SI (m), viser i 'm' | 'ft'.
function lenInput(si, unit, onSI) {
  return numInput(round(lenFromSI(si, unit)), unit === 'ft' ? 0.1 : 0.05,
    v => onSI(lenToSI(v, unit)));
}

// Tværsnits-input: gemmer mm, viser i 'mm' | 'in'.
function dimInput(mm, unit, onMM) {
  return numInput(round(dimFromMM(mm, unit)), unit === 'in' ? 0.05 : 1,
    v => onMM(dimToMM(v, unit)));
}

function select(options, value, onChange) {
  const sel = el('select', {},
    ...options.map(([v, label]) => {
      const o = el('option', { value: v }, label);
      if (v === value) o.selected = true;
      return o;
    }));
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

// Enheds-skifter (segmenteret knaprække).
function unitToggle(label, options, value, onChange) {
  return el('div', { class: 'utog' },
    el('span', { class: 'utog-l' }, label),
    el('div', { class: 'utog-bs' },
      ...options.map(([v, txt]) =>
        el('button', {
          class: 'utog-b' + (v === value ? ' on' : ''),
          type: 'button',
          onclick: () => { if (v !== value) onChange(v); },
        }, txt))));
}
