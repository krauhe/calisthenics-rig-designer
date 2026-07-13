// Håndtegnede SVG-grafer. Ingen chart-bibliotek nødvendigt.


const COLORS = ['#4f9bff', '#2e9e5b', '#d98324', '#7a4fb5', '#0e7490', '#ff6f66', '#5b7c0a', '#9b1c6b'];

// Løbenummer til unikke clipPath-id'er — flere grafer på samme side må ikke
// dele id, ellers klipper den ene grafs rektangel de andre.
let _chartSeq = 0;

// Generisk graf: én ELLER flere kurver. Giv enten `points` (+ color) eller
// `series` = [{ points, color }]. vLine/hLine: valgfri lodret/vandret reference.
function lineChart({ points, series, xMin, xMax, yMax, xLabel, yLabel, color = '#4f9bff', vLine, hLine, lang }) {
  const W = 400, H = 210, L = 48, R = 14, Tp = 10, B = 30;
  const x0 = L, x1 = W - R, y0 = H - B, y1 = Tp;
  yMax = yMax > 0 ? yMax : 1;
  const X = x => x0 + (x - xMin) / (xMax - xMin) * (x1 - x0);
  const Y = y => y0 - Math.max(y, 0) / yMax * (y0 - y1);  // ingen øvre klemning — linjer klippes i toppen
  const frac = [0, 0.25, 0.5, 0.75, 1];
  const yFmtDigits = yMax < 0.1 ? 3 : yMax < 1 ? 2 : yMax < 10 ? 1 : 0;
  const yGrid = frac.map(f => f * yMax).map(v =>
    `<line x1="${x0}" y1="${Y(v)}" x2="${x1}" y2="${Y(v)}" stroke="rgba(255,255,255,.07)"/>` +
    `<text x="${x0 - 6}" y="${Y(v) + 3}" text-anchor="end" font-size="9" fill="#9aa6b3">${fmt(v, yFmtDigits, lang)}</text>`).join('');
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
  const clipId = 'lcclip' + (++_chartSeq);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" xmlns="http://www.w3.org/2000/svg">
    ${yGrid}${xGrid}
    <line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="#56657a"/>
    <line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" stroke="#56657a"/>
    <defs><clipPath id="${clipId}"><rect x="${x0}" y="${y1}" width="${x1 - x0}" height="${y0 - y1}"/></clipPath></defs>
    <g clip-path="url(#${clipId})">${poly}</g>${vl}${hl}
    <text x="${(x0 + x1) / 2}" y="${H - 2}" text-anchor="middle" font-size="9.5" fill="#9aa6b3">${xLabel}</text>
    <text x="11" y="${(y0 + y1) / 2}" text-anchor="middle" font-size="9.5" fill="#9aa6b3" transform="rotate(-90 11 ${(y0 + y1) / 2})">${yLabel}</text>
  </svg>`;
}
