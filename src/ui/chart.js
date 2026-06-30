// Håndtegnede SVG-grafer. Ingen chart-bibliotek nødvendigt.


const COLORS = ['#4f9bff', '#2e9e5b', '#d98324', '#7a4fb5', '#0e7490', '#ff6f66', '#5b7c0a', '#9b1c6b'];

// Bæreevne (arbejdsgrænse) som funktion af spændvidde, én kurve pr. materiale.
// massU: 'kg' | 'lb' — kun visnings-/akse-enhed; y-skalaen regnes i kg.
function capacityChart({ library, fixity, currentSpan, load, massU = 'kg', metric = 'ult', yLabelKey = 'bar.chart.y', t, lang }) {
  const prop = metric === 'yield' ? 'pYield' : 'pUlt';
  const W = 400, H = 250, L = 46, R = 14, Tp = 12, B = 34;
  const x0 = L, x1 = W - R, y0 = H - B, y1 = Tp;
  const sMin = 0.5, sMax = 3.0, yMax = 250;             // kg-skala (loft for læsbarhed)
  const X = s => x0 + (s - sMin) / (sMax - sMin) * (x1 - x0);
  const Y = v => y0 - Math.max(v, 0) / yMax * (y0 - y1);  // ingen øvre klemning — klippes i toppen

  const spans = [];
  for (let s = sMin; s <= sMax + 1e-9; s += 0.1) spans.push(Math.round(s * 100) / 100);

  const yGrid = [0, 50, 100, 150, 200, 250].map(v =>
    `<line x1="${x0}" y1="${Y(v)}" x2="${x1}" y2="${Y(v)}" stroke="rgba(255,255,255,.07)"/>` +
    `<text x="${x0 - 6}" y="${Y(v) + 3}" text-anchor="end" font-size="9" fill="#9aa6b3">${massU === 'lb' ? Math.round(massFromSI(v, 'lb')) : v}</text>`).join('');
  const xGrid = [0.5, 1, 1.5, 2, 2.5, 3].map(v =>
    `<line x1="${X(v)}" y1="${y0}" x2="${X(v)}" y2="${y1}" stroke="rgba(255,255,255,.045)"/>` +
    `<text x="${X(v)}" y="${y0 + 14}" text-anchor="middle" font-size="9" fill="#9aa6b3">${fmt(v, 1, lang)}</text>`).join('');

  const lines = library.map((m, i) => {
    const pts = spans.map(s => `${X(s).toFixed(1)},${Y(beam(s, m, 1, fixity)[prop]).toFixed(1)}`).join(' ');
    return `<polyline fill="none" stroke="${COLORS[i % COLORS.length]}" stroke-width="2" points="${pts}"/>`;
  }).join('');

  const loadLine = load <= yMax
    ? `<line x1="${x0}" y1="${Y(load)}" x2="${x1}" y2="${Y(load)}" stroke="#ff6f66" stroke-dasharray="4 3" stroke-width="1.4"/>` +
      `<text x="${x1 - 2}" y="${Y(load) - 3}" text-anchor="end" font-size="9" fill="#ff6f66">${fmtMass(load, massU, lang)} · ${t('bar.chart.load', lang)}</text>`
    : '';
  const spanLine = currentSpan >= sMin && currentSpan <= sMax
    ? `<line x1="${X(currentSpan)}" y1="${y0}" x2="${X(currentSpan)}" y2="${y1}" stroke="#4f9bff" stroke-dasharray="3 3" stroke-width="1.2"/>` : '';

  return `<svg viewBox="0 0 ${W} ${H}" class="chart" xmlns="http://www.w3.org/2000/svg">
    ${yGrid}${xGrid}
    <line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="#56657a"/>
    <line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" stroke="#56657a"/>
    <defs><clipPath id="ccclip"><rect x="${x0}" y="${y1}" width="${x1 - x0}" height="${y0 - y1}"/></clipPath></defs>
    <g clip-path="url(#ccclip)">${lines}</g>${loadLine}${spanLine}
    <text x="${(x0 + x1) / 2}" y="${H - 2}" text-anchor="middle" font-size="9.5" fill="#9aa6b3">${t('bar.chart.x', lang)}</text>
    <text x="11" y="${(y0 + y1) / 2}" text-anchor="middle" font-size="9.5" fill="#9aa6b3" transform="rotate(-90 11 ${(y0 + y1) / 2})">${t(yLabelKey, lang)} (${massU === 'lb' ? 'lbs' : 'kg'})</text>
  </svg>`;
}

// Generisk graf: én ELLER flere kurver. Giv enten `points` (+ color) eller
// `series` = [{ points, color }]. vLine/hLine: valgfri lodret/vandret reference.
function lineChart({ points, series, xMin, xMax, yMax, xLabel, yLabel, color = '#4f9bff', vLine, hLine, lang }) {
  const W = 400, H = 210, L = 48, R = 14, Tp = 10, B = 30;
  const x0 = L, x1 = W - R, y0 = H - B, y1 = Tp;
  yMax = yMax > 0 ? yMax : 1;
  const X = x => x0 + (x - xMin) / (xMax - xMin) * (x1 - x0);
  const Y = y => y0 - Math.max(y, 0) / yMax * (y0 - y1);  // ingen øvre klemning — linjer klippes i toppen
  const frac = [0, 0.25, 0.5, 0.75, 1];
  const yGrid = frac.map(f => f * yMax).map(v =>
    `<line x1="${x0}" y1="${Y(v)}" x2="${x1}" y2="${Y(v)}" stroke="rgba(255,255,255,.07)"/>` +
    `<text x="${x0 - 6}" y="${Y(v) + 3}" text-anchor="end" font-size="9" fill="#9aa6b3">${fmt(v, v < 10 ? 1 : 0, lang)}</text>`).join('');
  const xGrid = frac.map(f => xMin + f * (xMax - xMin)).map(v =>
    `<line x1="${X(v)}" y1="${y0}" x2="${X(v)}" y2="${y1}" stroke="rgba(255,255,255,.045)"/>` +
    `<text x="${X(v)}" y="${y0 + 14}" text-anchor="middle" font-size="9" fill="#9aa6b3">${fmt(v, (xMax - xMin) <= 10 ? 1 : 0, lang)}</text>`).join('');
  const allSeries = series || [{ points, color }];
  const poly = allSeries.map(s =>
    `<polyline fill="none" stroke="${s.color || color}" stroke-width="2" points="${s.points.map(p => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')}"/>`).join('');
  const vl = (vLine != null && vLine >= xMin && vLine <= xMax)
    ? `<line x1="${X(vLine)}" y1="${y0}" x2="${X(vLine)}" y2="${y1}" stroke="#4f9bff" stroke-dasharray="3 3" stroke-width="1.2"/>` : '';
  const hl = (hLine != null && hLine <= yMax)
    ? `<line x1="${x0}" y1="${Y(hLine)}" x2="${x1}" y2="${Y(hLine)}" stroke="#ff6f66" stroke-dasharray="4 3" stroke-width="1.2"/>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" xmlns="http://www.w3.org/2000/svg">
    ${yGrid}${xGrid}
    <line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="#56657a"/>
    <line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" stroke="#56657a"/>
    <defs><clipPath id="lcclip"><rect x="${x0}" y="${y1}" width="${x1 - x0}" height="${y0 - y1}"/></clipPath></defs>
    <g clip-path="url(#lcclip)">${poly}</g>${vl}${hl}
    <text x="${(x0 + x1) / 2}" y="${H - 2}" text-anchor="middle" font-size="9.5" fill="#9aa6b3">${xLabel}</text>
    <text x="11" y="${(y0 + y1) / 2}" text-anchor="middle" font-size="9.5" fill="#9aa6b3" transform="rotate(-90 11 ${(y0 + y1) / 2})">${yLabel}</text>
  </svg>`;
}
