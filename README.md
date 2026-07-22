# Calisthenics Rig Designer

An interactive planner for a backyard calisthenics / pull-up rig. Draw the
ground plan top‑down, place posts, bars, ladders, monkey bars and a person, and
get live structural feedback (safe load, breaking load, deflection, foundation
stiffness) plus a 3D view, a material list, a cutting plan and a printable build
guide.

**▶ Run it in your browser (no install): <https://krauhe.github.io/calisthenics-rig-designer/>**

![3D rendering of the rig](calisthenics-render.png)

> The UI is in Danish 🇩🇰 (with an English toggle).

## Tabs

**Project**
- **Kort (Map)** — top‑down CAD‑style editor: a left‑hand tool palette (select/move,
  post, connect, ladder, monkey bars, person, delete), grid snapping, alignment guides,
  pan/zoom (remembered across reloads), and editable tables for every placed element.
  Set **height, burial depth and hole size** per post, and material, height and pipe wall
  thickness per connection. Posts are flagged **red** when too soft; connections are
  flagged red when under‑dimensioned. Elements can also be removed from the tables;
  dependent ladders and monkey bars are shown in a confirmation before cascade deletion.
- **3D** — the same design rendered in Three.js (posts, bars, Kee‑fittings, ladders,
  monkey bars, foundations, labels and a person), drag to rotate, scroll to zoom.
- **Materialer (Materials)** — editable default wall thickness per pipe diameter,
  shopping list (posts, bars, fittings, concrete, gravel, tar, screws) and a visual
  **cutting plan** that bin‑packs steel/wood into stock lengths. Standard pipes begin
  with their catalogue wall thickness; changing it here updates every connection of
  that diameter which does not have an individual override on the Map.

**Analysis** (calculators, independent of the drawing)
- **Stolpe (Post)** — foundation/sway analysis for a single post vs. burial depth.
- **Bar** — bending: safe working load, breaking load and deflection vs. span.

Other: three ready-made **example rigs**, **da/en** i18n, **per‑tab units** (m/ft,
mm/in), named browser saves, JSON **save/load**, `localStorage` autosave, undo/redo and
a printable build guide with top and 3D views, dimensions, materials and cutting plan.

## Run it

- **From the web (recommended):** open <https://krauhe.github.io/calisthenics-rig-designer/>.
  It's served by GitHub Pages straight from this repo's `main` branch — every push
  redeploys automatically (~1 min). Three.js is bundled in the repo
  (`vendor/three.module.js`), so the 3D tab has no CDN dependency.
- **Offline, single file:** double‑click [`calisthenics-lokal.html`](calisthenics-lokal.html)
  — all HTML/CSS/JS bundled into one file. **Exception:** if the file is shared alone
  (without the `vendor/` folder next to it), the 3D tab falls back to loading Three.js
  from a CDN and needs internet; everything else works fully offline.
- **Locally, multi‑file:** open [`index.html`](index.html) (loads the `src/` scripts).

## Develop

Source lives in `src/` (framework‑free classic scripts: `core/` engine + `ui/` views).
After any change, regenerate both entry points:

```sh
python build.py   # rebuilds index.html (multi-file) and calisthenics-lokal.html (bundle)
```

There is no compile/bundler step to *run* the app — `build.py` just concatenates the
sources. Math is checked by `tests/`: run `npm test` (Node, no install needed) or open
`tests/run-tests.html` in a browser (works from `file://` too).

## Engineering assumptions

Simplified hand‑calculation models for planning, **not** a substitute for a structural
engineer:

- Steel water pipe: E = 210 GPa, yield ≈ 195 MPa, ultimate ≈ 320 MPa (EN 10255 S195T);
  catalogue pipes start with their documented wall thickness (2.6 mm for 3/4", 3.2 mm
  for 1" and up, EN 10255 medium). The default for each diameter can be changed under
  Materials, and a single connection can override that default on the Map. Strength,
  deflection, material totals, cutting plans and print output all use the effective value.
- Wood (C24 pine): E ≈ 10 GPa, bending strength ≈ 24 MPa.
- Kee‑clamp end fixity estimated at 25 % (between pinned and fixed); a bound ladder
  relieves its bar as an extra support.
- Soil horizontal subgrade modulus ≈ 20 MN/m³; foundation rotational stiffness scales
  with hole width and depth.
- Loads are static; add a dynamic factor (≈ ×2) for swinging/jumping.

## Disclaimer

This tool produces **simplified estimates for planning only**. It is **not** a substitute
for a qualified structural engineer, and **no guarantee is made as to the correctness,
accuracy, or fitness for any purpose** of any result it produces. You use it **entirely at
your own risk**. The author accepts **no liability** for any injury, damage, or loss
arising from its use. Always have load‑bearing or body‑weight‑bearing structures reviewed
and verified by a qualified professional before building. (This is in addition to the
warranty disclaimer in the [GPLv3](LICENSE).)

## Tech

Vanilla JS (framework‑free classic scripts) + Three.js (bundled in `vendor/`, MIT‑licensed,
with a CDN fallback). No build step required to run.

## License

[GNU GPLv3](LICENSE) — © 2026 Kristian Rauhe Harreby. You may copy, modify and
redistribute, including commercially, but derivative works must remain open source under
the GPLv3 and credit the author.

Built with [Claude Code](https://claude.com/claude-code) and OpenAI Codex.
