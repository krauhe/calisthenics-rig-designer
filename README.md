# Calisthenics Rig Designer

An interactive 3D designer for a backyard calisthenics / pull-up rig, built as a single self-contained HTML file using [Three.js](https://threejs.org/). Design the frame, pick pipe sizes by clicking the bars, and get live structural feedback (deflection, breaking strength, foundation stiffness) plus a material list and a 6 m pipe cutting plan.

![3D rendering of the rig](chalestetics-render.png)

> The UI is in Danish. 🇩🇰

## Features

- **Live 3D model** of a 4-post rectangular rig (pressure-treated 12.5×12.5 cm posts) with horizontal bars.
- **Click a bar** to cycle its material/size: 3/4″ → 1″ → 1¼″ steel pipe → 10×10 cm wood.
- **Hover** any bar or post for specs: span, deflection at a chosen load, yield/breaking load, foundation stiffness.
- **Adjustable geometry** — long/short sides, per-side bar heights (10 cm steps), set a height ≥ post height to lay a bar *on top* of the posts.
- **Integrated ladder** on the left long side: vertical 1″ pipe cast ½ m into the ground, joined to the pull-up bar, with rungs every 40 cm.
- **Foundation modelling** — hole depth & width, gravel + concrete, tar zone; rotational stiffness scales with width × depth³.
- **Engineering calcs** — simply-supported / fixed / realistic (Kee-clamp) deflection, breaking strength, all split per side.
- **Material list** with concrete bag estimate, gravel, tar, fittings, screws.
- **Cutting plan** — bin-packs all steel pieces into 6 m stock bars (first-fit-decreasing, 4 mm kerf) and draws each bar's cuts.
- **Settings persist** in the browser via `localStorage`.

## Run it

It's a single file — just open [`chalestetics-3d.html`](chalestetics-3d.html) in a modern browser. Three.js is loaded from a CDN, so you need to be online the first time.

For a clean URL (and GitHub Pages), [`index.html`](index.html) redirects to the app.

### Controls
- **Drag** = rotate · **Scroll** = zoom · **Right-drag** = pan
- **Click a bar** = change its pipe size / material
- **Hover** = show specs

## Engineering assumptions

These are simplified hand-calculation models for planning, **not** a substitute for a structural engineer:

- Steel water pipe: E = 210 GPa, yield ≈ 195 MPa, ultimate ≈ 320 MPa (EN 10255 S195T).
- Wood (C24 pine): E ≈ 10 GPa, bending strength ≈ 24 MPa.
- Kee-clamp end fixity estimated at 25 % (between pinned and fixed).
- Soil horizontal subgrade modulus ≈ 20 MN/m³ (medium/firm soil).
- Loads are static; add a dynamic factor (≈ ×2) for swinging/jumping.

## Tech

Vanilla JS + Three.js (ES modules via CDN). No build step.

## License

[GNU GPLv3](LICENSE) — © 2026 Kristian Rauhe. You may copy, modify and redistribute, including commercially, but derivative works must remain open source under the GPLv3 and credit the author.

🤖 Initial version generated with [Claude Code](https://claude.com/claude-code).
