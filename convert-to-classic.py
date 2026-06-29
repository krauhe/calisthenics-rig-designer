# ENGANGS-konvertering: gør ES-modulerne i src/ til KLASSISKE scripts ved at
# fjerne import/export. Bagefter kan filerne loades med almindelige
# <script src="..."> i index.html — og dermed køre direkte fra en fil (file://),
# præcis som T1D-projektet. (Kør "python build.py" bagefter for at gendanne
# index.html + enkelt-fil-bundlen.)
#
# Kør én gang:  python convert-to-classic.py

import re
import pathlib

root = pathlib.Path(__file__).resolve().parent

ORDER = [
    'src/core/constants.js', 'src/core/units.js', 'src/core/sections.js',
    'src/core/mechanics.js', 'src/core/foundation.js', 'src/core/cutplan.js',
    'src/core/materials.js', 'src/core/model.js', 'src/core/schema.js', 'src/core/store.js',
    'src/core/locales/da.js', 'src/core/locales/en.js', 'src/core/i18n.js',
    'src/ui/dom.js', 'src/ui/controls.js', 'src/ui/chart.js', 'src/ui/library.js',
    'src/ui/saveload.js', 'src/ui/tabPost.js', 'src/ui/tabBar.js', 'src/ui/tabSite.js',
    'src/ui/tabs.js', 'src/main.js',
]


def to_classic(js):
    out = []
    for line in js.splitlines():
        s = line.strip()
        if s.startswith('import ') and ' from ' in s:
            continue                      # fjern import-linjer
        line = re.sub(r'^(\s*)export\s+', r'\1', line)  # export const/function -> const/function
        out.append(line)
    return '\n'.join(out).rstrip('\n') + '\n'


for f in ORDER:
    p = root / f
    p.write_text(to_classic(p.read_text(encoding='utf-8')), encoding='utf-8')
    print('klassisk:', f)

print('Færdig. Kør nu: python build.py')
