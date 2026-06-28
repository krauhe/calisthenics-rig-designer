// Minimal i18n: to flade ordlister + en opslagsfunktion. Dansk er standard
// og reserve, så en manglende engelsk nøgle aldrig giver et tomt felt.

import { da } from './locales/da.js';
import { en } from './locales/en.js';

const TABLES = { da, en };

export function t(key, lang = 'da') {
  const table = TABLES[lang] || da;
  return table[key] ?? da[key] ?? key;
}

export const LANGS = [['da', 'Dansk'], ['en', 'English']];
