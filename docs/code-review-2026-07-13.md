# Code review: Calisthenics Rig Designer

**Dato:** 2026-07-13 · **Omfang:** hele kodebasen (src/core, src/ui, build/test/PWA/infrastruktur) · **Metode:** tre parallelle, uafhængige gennemgange (kerne, UI, infrastruktur); alle fund er verificeret ved genlæsning af koden, og testkørslen er reproduceret.

> **STATUS (2026-07-13, senere samme dag): UDBEDRET.** K1, alle Høj-fund og alle
> Mellem-fund (undtagen M4's fundamentmodel-forbehold, som er accepteret som
> planlægningsoverslag) samt hovedparten af Lav-fundene er rettet.
> Testsuiten kører igen: `npm test` og `tests/run-tests.html`.
> Undtagelser/bevidste fravalg: M6's "render muterer uden commit" er afbødet via
> input-sanering i `fill()` frem for commit-i-render; tilgængelighed er kun løftet
> minimalt (aria-live på hjælpelinjen); PLAN.md's historiske afsnit står som historik
> med korrigeret status-afsnit.
>
> **Opdatering 2026-07-15:** M9 lukket (PNG-ikoner 192/512 + maskable + apple-touch-icon);
> testdæknings-punkt 9 lukket (computeMaterials flyttet til kernen og testet); Three.js
> bundlet lokalt (vendor/) så 3D ikke afhænger af CDN. Suiten er nu 105/105.
>
> **Opdatering 2026-07-22:** De resterende render-mutationer i Kort-, Stolpe- og
> Bar-fanerne er fjernet; normalisering sker nu ved import eller som en eksplicit
> brugerændring. Korrupt autosave vises som en advarsel efter sikkerhedskopiering,
> Gem-menuen kan lukkes med Escape, og faner/kort/vigtige tabelinput har fået
> tastatur- og ARIA-understøttelse. Bygningen stopper nu tydeligt ved utilsigtet ESM
> i stedet for at generere to forskelligt defekte appvarianter. Suiten er 118/118.

## Resumé

Arkitekturen er usædvanligt sund for et hobbyprojekt: ren regnekerne uden DOM, konsekvent SI-disciplin med enhedskonvertering kun i kanten, korrekt undo/redo-stak, og bjælkematematikken i `mechanics.js` er efterregnet og **eksakt**. Men projektets sikkerhedsnet er faldet ned:

1. **Testsuiten kan ikke køre** — de "42/42 tests", der skulle låse den sikkerhedsrelevante matematik, har ikke kunnet køre siden omlægningen til klassiske scripts.
2. **Rør-bæreevne vises for højt** for 3/4"-rør (~15 %), fordi den globale godstykkelse-antagelse overskriver katalogets korrekte værdi.
3. **Én reel XSS-sårbarhed** via materialenavne i importeret JSON.
4. **Materialeliste/print regner stiger ud fra en anden bar** end den, kortet og 3D viser → forkerte indkøbstal.

Anbefalet rækkefølge: fix #1 (K1) først — alt andet bliver lettere at rette sikkert bagefter.

---

## Kritisk

### K1. Hele testsuiten er død — hverken Node eller browser kan køre den
`tests/tests.js:10-17` importerer `sectionProps`, `beam`, `foundation`, `CATALOG` m.fl. som ES-moduler, men `convert-to-classic.py` fjernede alle `export`-statements fra `src/`. Verificeret ved kørsel: `npm test` dør med `SyntaxError: The requested module '../src/core/materials.js' does not provide an export named 'CATALOG'`; `tests/run-tests.html` fejler af samme grund. En regnefejl i `mechanics.js`/`foundation.js` — i en app hvor folk hænger deres kropsvægt i resultaterne — kan ikke fanges. README.md:55 og PLAN.md:263 ("42/42 tests") er falske i dag.
**Fix-retning:** enten (a) lad `tests/node-run.mjs` konkatenere kernefilerne og køre dem i en `vm`-kontekst (samme princip som `build.py`), eller (b) genindfør ESM i `src/` og lad `build.py` generere de klassiske kopier.

---

## Høj

### H1. Global rør-godstykkelse overskriver katalogets korrekte værdi — ukonservativt
`schema.js:89` (og duplikeret i `tabSite.js:44` og `tabSite.js:933`): alle rør-materialer får `wall = site.pipeWall_mm` (default 3,2) ved hver load. Kataloget (`materials.js:12`) angiver korrekt 2,6 mm for 3/4"-rør (EN 10255 medium) — den værdi er reelt død kode. Konsekvens: I og Z overvurderes ~15 % for det spinkleste rør i kataloget, så "sikker last" og stivhed vises for højt. Brugeroprettede rør klobres også. Antagelsen bør kun gælde materialer uden eksplicit gods.

### H2. XSS via materialenavne i importeret JSON
`tabBar.js:100, 134, 146`: `mat.name` indsættes uescaped i `innerHTML`. En delt `rig.json` med `name: "<img src=x onerror=...>"` består `fill()`-normaliseringen, autosaves til localStorage og kører scriptet hver gang Bjælke-fanen åbnes — persistent. Eneste fundne sink; resten af appen bruger `el()`/textContent og er sikker.

### H3. Touch-koordinater skævvredet på mobil (letterboxing)
`tabSite.js:116-119` antager at SVG'en fylder hele `.map`-boksen, men `style.css:593` sætter `aspect-ratio: 1/1` ved ≤720 px, mens viewBox er 520×440 med `meet` → ~31 px letterbox. Tap nær kortets over-/underkant rammer op til ~0,5 m forkert, og placeringspunkt matcher ikke hit-test. Ret CSS til `aspect-ratio: 520/440` eller kompensér i `evtToUser`.

### H4. Materialeliste/print bruger en anden stige-bar end Kort/3D
`tabMaterials.js:42-47` vælger altid den *højeste* bar på stolpen og ignorerer `at.angle_rad`; `tabSite.js:190-202` og `tabView3d.js:312-321` vælger baren efter stigens retning. Med en bar i 2,5 m og en i 1,0 m viser kortet en stige til 1,0 m, mens styklisten fakturerer rør/trin/beslag til den høje — forkert indkøbs- og skæreliste. `ladderBar` findes i 3 divergerende kopier og bør samles i `model.js`.

### H5. `npm run build` (Vite) producerer brudt `dist/`; deploy-workflow findes ikke
`vite.config.js:6`, `package.json:12`: `index.html` bruger klassiske script-tags, som Vite ikke bundler → `dist/` mangler al JS. `base: '/calisthenics-rig-designer/'` og PLAN.md:72's `deploy.yml` matcher ikke virkeligheden (Pages serverer rå `main`). Vite er død vægt — slet eller dokumentér.

### H6. Et `export` i en src-fil knækker appen stille
`index.html:24-50` loader `src/` som klassiske scripts; ét tilføjet `export` (naturligt, da testene importerer fra samme filer!) giver runtime-SyntaxError og manglende globals. `build.py:39-47`'s `strip_module()` håndterer desuden ikke multi-line imports, side-effekt-imports eller `export default`. Samme rodårsag som K1.

---

## Mellem

### M1. Import/adopt validerer ikke indholdet — NaN-propagering
`schema.js:56` accepterer vilkårligt `library`-array; `validate()` (`schema.js:122-128`) tjekker kun eksistens. `library: [{}]` giver via fallback (`model.js:54,77`) et materiale uden `kind/od/E` → NaN i alle beregninger uden fejlmelding. `fill()` sanerer heller ikke `posts[i].x_m/z_m` (NaN-spænd) og `posts: [null]` giver TypeError i stedet for pæn `invalid-design`. Også `stock` af forkert type accepteres (`schema.js:64,106`).

### M2. Korrupt autosave kasseres lydløst og overskrives
`store.js:82-93`: parse-/adopt-fejl → tavs fallback til default, og første `commit()` overskriver den korrupte men måske reparérbare payload permanent. Gem en backup-kopi (fx `KEY + '-corrupt'`) og vis en advarsel.

### M3. Tjære-konstanter stemmer ikke med den printede vejledning
`constants.js:22-23` (zone −0,5 m → +0,10 m) vs. `print.step3` (da.js:218): "fra ca. 20 cm over jord til bunden". For en 1,2 m stolpe undervurderes indkøbsmængden af tjære med over en faktor 2 i forhold til instruktionen. Konstanterne er desuden duplikeret lokalt i `tabView3d.js:77` (skygge-kopi der kan divergere).

### M4. Fundamentmodellen: forbehold + hul = 0 tilladt
`foundation.js:30-38`: rotationsfjeder om jordlinjen uden vandret translationsled — overvurderer stivheden ved lave dybder (ukonservativt netop hvor advarslen skal virke). `schema.js:76,95` tillader `hole_mm = 0` → `dRot = Infinity`; minimum `hole ≥ postSide` i `fill()` koster én linje.

### M5. Print bruger stale design efter undo/redo
`saveload.js:137` + `print.js:63`: `printGuide(ctx)` læser headerens gamle `ctx.design`; `store.undo()` erstatter design-objektet men re-renderer kun den aktive fane. Bruger fortryder en fejl og printer — og får vejledningen for tilstanden *før* fortryd. (Samme rodårsag: navnefeltet i headeren efter undo.)

### M6. Mutation uden commit (flere varianter)
- Pinch afbryder post-træk uden commit (`tabSite.js:687-696`): flytningen står på skærmen men er hverken autosavet eller på undo-stakken.
- Klik på stolpe kan grid-snappe den ukommitteret (`tabSite.js:761-768`): mutér først når `drag.moved` er sat.
- Render muterer design uden commit (`tabSite.js:107,493`, `tabBar.js:26-27`): det viste og det gemte divergerer indtil næste urelaterede commit.

### M7. Undo-historik oversvømmes: ét commit pr. tastetryk
`store.js:21-28` + `input`-listeners overalt: at skrive "Min pull-up rig" giver 16 undo-trin og 16 fulde JSON-serialiseringer; `HISTORY_MAX = 80` skubber meningsfulde tilstande ud. Commit på `change`/debounce i stedet.

### M8. Service worker: ingen oprydning + cacher fejlsvar
`sw.js:5,9`: `activate` sletter aldrig gamle caches — efter filomdøbningen ligger de gamle URL'er der for evigt. `sw.js:16-18`: `c.put()` uden `resp.ok`-tjek — et 404 under et Pages-deploy overskriver et godt cachet svar, og appen dør offline.

### M9. PWA-ikoner utilstrækkelige
`manifest.json:8-14`: kun SVG (`sizes:"any"`), ingen 192/512 px PNG, ingen maskable, ingen `apple-touch-icon` → iOS ignorerer ikonet; installability ikke garanteret på tværs.

### M10. 3D-fanen: ingen pinch-zoom, ressource-lækager
`tabView3d.js:436-463`: zoom kun via `wheel`; mobilbrugere kan aldrig zoome, og to fingre får kameraet til at hoppe. rAF-loopet kører 60 fps på statisk scene; geometrier/teksturer disposes aldrig; hvert fanebesøg opretter ny WebGL-kontekst. En fejlet Three-load caches permanent i `_threeP` (`tabView3d.js:10-26`).

### M11. Import af .json fitter ikke kortudsnittet
`saveload.js:27-42` sætter ikke `tabSite.fitNext = true` (i modsætning til "Åbn lokalt" og presets) — en delt rig tegnet langt fra origo ser ud som en fejlet import.

### M12. README/PLAN i modstrid med virkeligheden
PLAN.md:264-274: forkert om `index.html`/`app.html`-rollerne, "Node ikke installeret" (v24 findes), "42/42 tests består" (kan ikke køre), mappestruktur nævner filer der ikke findes. README.md:41-42: enkelt-filen loves self-contained, men Three.js hentes fra unpkg-CDN → 3D-fanen er død offline; linket til `calisthenics-3d.html` er brudt hvis modtageren kun har én fil.

---

## Lav (udvalg)

- **Zoom-knapper zoomer om world-origo** (`tabSite.js:921`) — indholdet driver ud af billedet; wheel-zoom gør det rigtigt.
- **Print/materialer ignorerer ft-enheden** (`print.js:67`, `tabMaterials.js:107`) — alt i meter, selv når kortet viser fod.
- **`selectedAvatar` nulstilles ikke** ved klik på stolpe-/forbindelsesrækker (`tabSite.js:551,599`).
- **Duplikerede SVG-clipPath-id'er** `id="lcclip"` (`chart.js:76`) — tre grafer på Bjælke-fanen deler id.
- **FileReader uden onerror** (`saveload.js:30-40`); **"Gem lokalt" overskriver uden varsel** (`saveload.js:62`); `newer-schema` og `invalid-json` giver samme generiske fejlbesked.
- **`hole_mm === 300`-migreringen** (`schema.js:73`) kan ramme et bevidst legacy-valg fra `fromLegacy()` (`schema.js:151`) — kommentaren "sættes aldrig manuelt" er faktuelt forkert.
- **Skæreplan** (`cutplan.js:17-25`): stykke længere end stangen giver negativ "rest" i visningen; kerf tælles pr. stykke (konservativt, harmløst).
- **Hardcodede danske navne** `'Min rig'`/`'Importeret rig'` (`model.js:11`, `schema.js:156`).
- **Autosave-debounce uden unload-flush** (`store.js:75-80`) — luk fanen straks efter en ændring og den er tabt.
- **`renderActive` uden guard** (`main.js:62-64`) — ukendt fane-id crasher appen; én linje fallback.
- **Død kode:** `tabs.js` (hele filen), `chart.js:8` `capacityChart`, `controls.js:49` `dimInput`, `library.js:10-38`, `store.js:97-117` (`addMaterial`/`removeMaterial`/`subscribe` — kaldes aldrig), `units.js:26,36`, `convert-to-classic.py` (forældet engangs-script), `calisthenics-original-1fil.html` (refereres ingen steder). 16 døde locale-nøgler (da/en er dog i perfekt paritet, 217/217).
- **Død/no-op CSS:** `.selpanel`, `.gridpresets`, `.conneditor`, `.matform*`, `.soon`, 560px-medieblok med flex-regler på grid-containere; `.filebar`-grid på mobil ombryder rodet.
- **Duplikering → delte helpers:** `effSpan` (tabSite ≡ tabView3d), `postLabelDir` (ditto, ~20 linjer), `holeToMm/FromMm` (tabSite ≡ tabPost), tjære/grus-konstanter (tabView3d skygger constants.js), `spanOf`s ubrugte parameter.
- **Tilgængelighed:** kort-SVG uden keyboard-adgang/roller, inputfelter uden aria-labels, hjælpetekst uden `aria-live`, Gem-menu lukker ikke på Escape.
- **`jsconfig.json`** lover `checkJs` der ikke kan virke med klassiske kryds-fil-globals; **lokale scripts** (`vis-lokalt.bat` åbner redirect-stubben `app.html`, anden port end `serve_preview.py`).

---

## Testdækning: vigtigste huller (prioriteret)

1. `schema.js` — `migrate()`, `fill()`, `adopt()`, `mergeCatalog()` med gamle/fremmede/halvkorrupte filer.
2. `store.js` — commit/undo/redo/loadDesign (korrupt localStorage, `HISTORY_MAX`-trunkering).
3. `model.js` — `monkeyGeometry()` + `monkeyPlacementValid()` (projektion/nærmeste-punkt-matematik, helt utestet).
4. `foundation()` med rør-stolpe og jordtype-varianter; `soilFactorOf()`.
5. `presets.js` — billig test: `validate(buildPreset(id))` for alle tre rigge.
6. `model.js`-opslagshjælperne (`resolveMaterial`, `spanOfConn`, defaults/overrides).
7. `cutplan.packPieces()` kant-tilfælde; i18n nøgle-paritet; materialeoptælling (ligger i UI-laget, uden for testrækkevidde — i strid med PLAN.md §3).

## Positivt verificeret

- `mechanics.js`-interpolationen er eksakt (midtermoment W·L·(1/4 − f/8) ≡ `cReal`), ikke en approksimation.
- `sections.js` I/Z/A-formler korrekte; mm/m-disciplinen holder ved alle `foundation()`-kald.
- `dom.js`'s `el()` med tekstnoder holder næsten hele appen XSS-fri; undo/redo-stakkens invarianter er korrekte.
- Pointer capture, pinch-matematik og wheel-zoom-anker på kortet er regnet rigtigt.
- Frisk `build.py`-kørsel er byte-identisk med de committede filer — intet stale output.

## Anbefalet handlingsrækkefølge

1. **K1** — få testsuiten til at køre (lås matematikken før alt andet).
2. **H1 + H2** — rørgods-klobning og XSS (sikkerhed/korrekthed for brugerne).
3. **H4 + M3** — stige-bar-uenighed og tjære-zonen (forkerte indkøbstal).
4. **H3 + M6/M7** — mobil-koordinater og commit-disciplin (mærkbar UX).
5. **M8/M9** — service worker + ikoner (offline-pålidelighed).
6. Oprydning: Vite ud, død kode/CSS ud, README/PLAN ajourført, delte helpers samlet i `model.js`.
