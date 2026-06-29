// Tværsnitsegenskaber: inertimoment I (m⁴), modstandsmoment Z (m³),
// areal A (m²). Bruges af både stolpe-, bar-, kort- og materialeberegninger.
//
// Et "section"-objekt beskriver geometrien (dimensioner i MILLIMETER):
//   { kind:'pipe', od, wall }   hult cirkulært rør (ydre-Ø og godstykkelse)
//   { kind:'wood', side }       massivt kvadratisk træ (sidemål)

function sectionProps(section) {
  if (section.kind === 'wood') {
    const b = section.side / 1000;            // mm → m
    return { I: b ** 4 / 12, Z: b ** 3 / 6, A: b * b };
  }
  // 'pipe' — hult cirkulært tværsnit
  const Do = section.od / 1000;               // ydre diameter (m)
  const Di = Math.max(0, section.od - 2 * section.wall) / 1000; // indre diameter (m)
  const I = Math.PI / 64 * (Do ** 4 - Di ** 4);
  const Z = I / (Do / 2);
  const A = Math.PI / 4 * (Do ** 2 - Di ** 2);
  return { I, Z, A };
}
