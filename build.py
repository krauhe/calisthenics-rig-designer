# Genererer to ting ud fra src/ (som nu er klassiske scripts):
#   1) index.html               - multi-fil-appen (klassiske <script src> i rækkefølge).
#                                  Kan dobbeltklikkes lokalt (file://) ELLER serveres online.
#   2) chalestetics-lokal.html  - alt samlet i ÉN selvstændig fil (til deling).
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
    'src/ui/tabView3d.js', 'src/ui/tabMaterials.js', 'src/ui/print.js', 'src/ui/tabs.js', 'src/main.js',
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


def strip_module(js):
    out = []
    for line in js.splitlines():
        s = line.strip()
        if s.startswith('import ') and ' from ' in s:
            continue
        line = re.sub(r'^(\s*)export\s+', r'\1', line)
        out.append(line)
    return '\n'.join(out)


# ---- 1) index.html (klassiske scripts) ----
tags = '\n'.join('<script src="{}"></script>'.format(f) for f in ORDER)
index = '''<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Calisthenics Rig Designer</title>
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

# ---- 2) chalestetics-lokal.html (alt i én fil) ----
bundle = '\n\n'.join(
    '// ===== {} =====\n{}'.format(f, strip_module((root / f).read_text(encoding='utf-8')))
    for f in ORDER
)
css = (root / 'src/ui/style.css').read_text(encoding='utf-8')
single = '''<!DOCTYPE html>
<!-- GENERERET af build.py - selvstaendig enkelt-fil. Ret i src/ og koer build.py. -->
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
%SHELL%
<script>
%JS%
</script>
</body>
</html>
'''.replace('%CSS%', css).replace('%SHELL%', SHELL).replace('%JS%', bundle)
(root / 'chalestetics-lokal.html').write_text(single, encoding='utf-8')

print('Skrev index.html (multi-fil) og chalestetics-lokal.html (enkelt-fil)')
