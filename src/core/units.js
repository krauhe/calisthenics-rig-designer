// Enhedskonvertering og visning.
//
// PRINCIP: modellen gemmer ALT i kanoniske enheder — længder i meter,
// tværsnit i millimeter. Tommer/fod er udelukkende et VISNINGS- og
// INPUT-anliggende, der håndteres her i kanten. Selve regnekernen
// (sections/mechanics/foundation) ser aldrig en enhed.

const MM_PER_IN = 25.4;   // eksakt
const M_PER_FT = 0.3048;  // eksakt

// ---- Længde: meter (intern) ↔ visningsenhed 'm' | 'ft' ----
const lenToSI   = (v, unit) => unit === 'ft' ? v * M_PER_FT : v;   // → m
const lenFromSI = (v, unit) => unit === 'ft' ? v / M_PER_FT : v;   // m →

// ---- Tværsnit: millimeter (intern) ↔ visningsenhed 'mm' | 'in' ----
const dimToMM   = (v, unit) => unit === 'in' ? v * MM_PER_IN : v;  // → mm
const dimFromMM = (v, unit) => unit === 'in' ? v / MM_PER_IN : v;  // mm →

// ---- Formattering (dansk komma som decimaltegn) ----
function fmt(v, digits = 2, lang = 'da') {
  const s = Number(v).toFixed(digits);
  return lang === 'da' ? s.replace('.', ',') : s;
}

// Tværsnit med enhed, fx "33 mm" / "1,33″"
function fmtDim(mm, unit = 'mm', lang = 'da', digits = unit === 'in' ? 2 : 0) {
  return fmt(dimFromMM(mm, unit), digits, lang) + (unit === 'in' ? '″' : ' mm');
}

// ---- Masse/last: kilogram (intern) ↔ visningsenhed 'kg' | 'lb' ----
const LB_PER_KG = 2.2046226218;
const massFromSI = (kg, unit) => unit === 'lb' ? kg * LB_PER_KG : kg;  // kg →
const massToSI = (v, unit) => unit === 'lb' ? v / LB_PER_KG : v;       // → kg
function fmtMass(kg, unit = 'kg', lang = 'da') {
  return unit === 'lb' ? fmt(kg * LB_PER_KG, 0, lang) + ' lbs' : fmt(kg, 0, lang) + ' kg';
}

// Lille forskydning (nedbøjning/sving) vist i valgt tværsnitsenhed: mm eller tommer.
function fmtDispl(mm, unit = 'mm', lang = 'da') {
  return unit === 'in'
    ? fmt(mm / MM_PER_IN, 2, lang) + '″'
    : fmt(mm, mm < 10 ? 2 : 1, lang) + ' mm';
}
