// Minimal i18n: to flade ordlister + en opslagsfunktion. Dansk er standard
// og reserve, så en manglende engelsk nøgle aldrig giver et tomt felt.


const TABLES = { da, en };

function t(key, lang = 'da') {
  const table = TABLES[lang] || da;
  return table[key] ?? da[key] ?? key;
}

const LANGS = [['da', 'Dansk'], ['en', 'English']];
