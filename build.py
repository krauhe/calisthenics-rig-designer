# Genererer to ting ud fra src/ (som nu er klassiske scripts):
#   1) index.html               - multi-fil-appen (klassiske <script src> i rækkefølge).
#                                  Kan dobbeltklikkes lokalt (file://) ELLER serveres online.
#   2) calisthenics-lokal.html  - alt samlet i ÉN selvstændig fil (til deling).
#
# Kør:  python build.py   (efter enhver ændring i src/)

import re
import pathlib

root = pathlib.Path(__file__).resolve().parent

# Filer i afhængigheds-rækkefølge (afhængigheder først, main.js sidst).
ORDER = [
    'src/core/constants.js', 'src/core/units.js', 'src/core/sections.js',
    'src/core/mechanics.js', 'src/core/foundation.js', 'src/core/cutplan.js',
    'src/core/materials.js', 'src/core/model.js', 'src/core/presets.js', 'src/core/schema.js', 'src/core/store.js',
    'src/core/locales/da.js', 'src/core/locales/en.js', 'src/core/i18n.js',
    'src/ui/dom.js', 'src/ui/controls.js', 'src/ui/chart.js', 'src/ui/library.js',
    'src/ui/saveload.js', 'src/ui/tabPost.js', 'src/ui/tabBar.js', 'src/ui/tabSite.js',
    'src/ui/tabView3d.js', 'src/ui/tabMaterials.js', 'src/ui/print.js', 'src/main.js',
]

SHELL = '''<div id="app">
  <header id="hd"></header>
  <nav id="tabbar"></nav>
  <main id="content"></main>
  <footer id="ft"></footer>
</div>'''

# Service worker registreres kun online (springes over på file://).
SW = '''<script>
  if (location.protocol !== 'file:' && 'serviceWorker' in navigator) {
    addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
</script>'''


def classic_source(path):
    js = path.read_text(encoding='utf-8')
    # index.html indlæser src/ som klassiske scripts. At fjerne import/export
    # kun i enkeltfilen ville derfor skjule en fejl og efterlade index.html
    # defekt. Stop bygningen med en tydelig besked i stedet.
    if re.search(r'^\s*(?:import\s|export\s)', js, re.MULTILINE):
        raise SystemExit('FEJL: %s indeholder ESM import/export, men src/ skal være klassiske scripts.' % path.relative_to(root))
    return js


# ---- 1) index.html (klassiske scripts) ----
tags = '\n'.join('<script src="{}"></script>'.format(f) for f in ORDER)
index = '''<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Calisthenics Rig Designer</title>
<link rel="icon" href="icon.svg" />
<link rel="apple-touch-icon" href="icon-192.png" />
<link rel="manifest" href="manifest.json" />
<meta name="theme-color" content="#0f141b" />
<link rel="stylesheet" href="src/ui/style.css" />
</head>
<body>
%SHELL%
%SW%
%TAGS%
</body>
</html>
'''.replace('%SHELL%', SHELL).replace('%SW%', SW).replace('%TAGS%', tags)
(root / 'index.html').write_text(index, encoding='utf-8')

# ---- 2) calisthenics-lokal.html (alt i én fil) ----
bundle = '\n\n'.join(
    '// ===== {} =====\n{}'.format(f, classic_source(root / f))
    for f in ORDER
)
# Skabelonen kan ikke baere disse tokens i kildekoden — fang det ved build-tid.
for bad in ('</script>', '%JS%', '%SHELL%', '%CSS%'):
    if bad in bundle:
        raise SystemExit('FEJL: kildekoden indeholder "%s" - enkelt-filen ville knaekke.' % bad)
css = (root / 'src/ui/style.css').read_text(encoding='utf-8')
single = '''<!DOCTYPE html>
<!-- GENERERET af build.py - selvstaendig enkelt-fil. Ret i src/ og koer build.py. -->
<html lang="da">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Calisthenics Rig Designer</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20rx%3D%2214%22%20fill%3D%22%230f141b%22/%3E%3Crect%20x%3D%2214%22%20y%3D%2216%22%20width%3D%225%22%20height%3D%2234%22%20rx%3D%222%22%20fill%3D%22%23b6986a%22/%3E%3Crect%20x%3D%2245%22%20y%3D%2216%22%20width%3D%225%22%20height%3D%2234%22%20rx%3D%222%22%20fill%3D%22%23b6986a%22/%3E%3Crect%20x%3D%2212%22%20y%3D%2218%22%20width%3D%2240%22%20height%3D%226%22%20rx%3D%223%22%20fill%3D%22%234f9bff%22/%3E%3C/svg%3E" />
<style>
%CSS%
</style>
</head>
<body>
%SHELL%
<script>
%JS%
</script>
</body>
</html>
'''.replace('%CSS%', css).replace('%SHELL%', SHELL).replace('%JS%', bundle)
(root / 'calisthenics-lokal.html').write_text(single, encoding='utf-8')

print('Skrev index.html (multi-fil) og calisthenics-lokal.html (enkelt-fil)')
