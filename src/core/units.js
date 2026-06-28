// Enhedskonvertering og visning.
//
// PRINCIP: modellen gemmer ALT i kanoniske enheder — længder i meter,
// tværsnit i millimeter. Tommer/fod er udelukkende et VISNINGS- og
// INPUT-anliggende, der håndteres her i kanten. Selve regnekernen
// (sections/mechanics/foundation) ser aldrig en enhed.

export const MM_PER_IN = 25.4;   // eksakt
export const M_PER_FT = 0.3048;  // eksakt

// ---- Længde: meter (intern) ↔ visningsenhed 'm' | 'ft' ----
export const lenToSI   = (v, unit) => unit === 'ft' ? v * M_PER_FT : v;   // → m
export const lenFromSI = (v, unit) => unit === 'ft' ? v / M_PER_FT : v;   // m →

// ---- Tværsnit: millimeter (intern) ↔ visningsenhed 'mm' | 'in' ----
export const dimToMM   = (v, unit) => unit === 'in' ? v * MM_PER_IN : v;  // → mm
export const dimFromMM = (v, unit) => unit === 'in' ? v / MM_PER_IN : v;  // mm →

// ---- Formattering (dansk komma som decimaltegn) ----
export function fmt(v, digits = 2, lang = 'da') {
  const s = Number(v).toFixed(digits);
  return lang === 'da' ? s.replace('.', ',') : s;
}

// Længde med enhed, fx "2,40 m" / "7.87 ft"
export function fmtLen(si, unit = 'm', lang = 'da', digits = 2) {
  return fmt(lenFromSI(si, unit), digits, lang) + ' ' + unit;
}

// Tværsnit med enhed, fx "33 mm" / "1,33″"
export function fmtDim(mm, unit = 'mm', lang = 'da', digits = unit === 'in' ? 2 : 0) {
  return fmt(dimFromMM(mm, unit), digits, lang) + (unit === 'in' ? '″' : ' mm');
}

// Nedbøjning i mm fra en SI-værdi i meter (fx 0.0364 → "36,4 mm")
export function fmtDeflection(si_m, lang = 'da') {
  const mm = si_m * 1000;
  return fmt(mm, mm < 10 ? 2 : 1, lang) + ' mm';
}
