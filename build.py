# Bygger en SELVSTÆNDIG enkelt-fil-udgave (chalestetics-lokal.html), som kan
# køres ved bare at dobbeltklikke den — ingen server nødvendig.
#
# Den samler alle ES-moduler + CSS til én fil: import/export-linjer fjernes,
# og koden lægges ind i ét almindeligt <script> i afhængigheds-rækkefølge.
#
# Kør:  python build.py

import re
import pathlib

root = pathlib.Path(__file__).resolve().parent

# Moduler i afhængigheds-rækkefølge (afhængigheder først).
ORDER = [
    'src/core/constants.js', 'src/core/units.js', 'src/core/sections.js',
    'src/core/mechanics.js', 'src/core/foundation.js', 'src/core/cutplan.js',
    'src/core/materials.js', 'src/core/model.js', 'src/core/schema.js', 'src/core/store.js',
    'src/core/locales/da.js', 'src/core/locales/en.js', 'src/core/i18n.js',
    'src/ui/dom.js', 'src/ui/controls.js', 'src/ui/chart.js', 'src/ui/library.js',
    'src/ui/saveload.js', 'src/ui/tabPost.js', 'src/ui/tabBar.js', 'src/ui/tabSite.js',
    'src/ui/tabs.js', 'src/main.js',
]


def strip_module(js):
    out = []
    for line in js.splitlines():
        s = line.strip()
        # drop import-linjer
        if s.startswith('import ') and ' from ' in s:
            continue
        # fjern 'export ' i starten af en linje (export const/function -> const/function)
        line = re.sub(r'^(\s*)export\s+', r'\1', line)
        out.append(line)
    return '\n'.join(out)


bundle = '\n\n'.join(
    '// ===== {} =====\n{}'.format(f, strip_module((root / f).read_text(encoding='utf-8')))
    for f in ORDER
)
css = (root / 'src/ui/style.css').read_text(encoding='utf-8')

html = '''<!DOCTYPE html>
<!--
  Chalestetics - Calisthenics Rig Designer (lokal, selvstaendig udgave)
  Copyright (C) 2026 Kristian Rauhe Harreby - GPLv3 (se LICENSE).
  GENERERET af build.py. Du kan bare DOBBELTKLIKKE denne fil - ingen server.
  Ret ikke i denne fil direkte; ret i src/ og koer "python build.py".
-->
<html lang="da">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Calisthenics Rig Designer</title>
<style>
%CSS%
</style>
</head>
<body>
<div id="app">
  <header id="hd"></header>
  <nav id="tabbar"></nav>
  <main id="content"></main>
  <footer id="ft"></footer>
</div>
<script>
%JS%
</script>
</body>
</html>
'''.replace('%CSS%', css).replace('%JS%', bundle)

out = root / 'chalestetics-lokal.html'
out.write_text(html, encoding='utf-8')
print('Skrev', out.name, '(' + str(len(html)) + ' tegn)')
