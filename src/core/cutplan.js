// Skæreplan: pak en liste af stykker ned i hele stænger med mindst muligt spild.
// First-Fit-Decreasing (FFD) bin-packing. Stanglængde og savsnit (kerf) er
// parametre, så materialelisten kan bruge brugerens egne indkøbslængder.
//
//   pieces : [{ len, label }]   stykkets længde (m) + en kort etiket
//   stock  : hel stanglængde (m)
//   kerf   : savsnit pr. snit (m) — lægges til hvert stykkes plads
//
// Returnerer { bars:[{ used, waste, pieces }], count }.


function packPieces(pieces, stock = STOCK, kerf = KERF) {
  const sorted = pieces.slice().sort((a, b) => b.len - a.len); // største først
  const bars = [];

  for (const p of sorted) {
    let bar = bars.find(b => b.used + p.len + kerf <= stock + 1e-9);
    if (!bar) { bar = { used: 0, pieces: [] }; bars.push(bar); }
    bar.used += p.len + kerf;     // inkl. savsnit
    bar.pieces.push(p);
  }

  for (const b of bars) {
    const sum = b.pieces.reduce((s, p) => s + p.len, 0);
    // resterende materiale (savsnit indregnet i 'used'); et overlangt stykke
    // (len > stock) må ikke give negativ rest i visningen — UI'et advarer separat
    b.waste = Math.max(0, stock - sum);
  }

  return { bars, count: bars.length };
}
