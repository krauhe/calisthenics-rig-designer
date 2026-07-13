# Plan: Forbedring af den horisontale stige (armgang / monkey bars)

**Dato:** 2026-07-13 · **Status:** IMPLEMENTERET samme dag (etape 1–4). Afvigelser fra planen:
`height_m`/`flip` blev IKKE nye datafelter — højden redigeres i skemaet og skriver direkte til
begge barers `height_m` (klampet af ny `monkeyMaxHeight()`), og retning styres med bar-par-dropdown
+ ⇄-byt-knap (ingen migration nødvendig). `R`-cyklus ved placering udgik (dropdown dækker behovet).
Af de valgfrie tiltag i §6 er nr. 1 (styrkeberegning af trin, ⚠-markering) også implementeret.

## 1. Sådan virker armgangen i dag

Armgangen er i dag et rent *afledt* element — den har næsten ingen egne parametre:

| Aspekt | I dag | Hvor i koden |
|---|---|---|
| Datamodel | `{ id, type:'monkey', connA, connB, spacing_m }` — kun trinafstand er egen parameter | `tabSite.js:827` |
| Retning | Afledes automatisk af de to barer (forbindelser) den hænger under; `monkeySnap` vælger selv nærmeste gyldige par | `tabSite.js:216-226` |
| Højde | Afledes: `y = min(barA.height_m, barB.height_m)` — kan ikke redigeres | `model.js:156` |
| Trin | Beregnes i `monkeyGeometry`: projektion af bar B på bar A, trin i overlappet med 12 cm endemargin | `model.js:109-158` |
| Validering | `monkeyPlacementValid`: parallelitet ≤ ~12°, trinlængde 0,25–1,6 m, overlap ≥ 0,4 m, højdeforskel ≤ 0,3 m | `model.js:162-165` |
| Skema th. | Findes allerede (afsnittet "Armgange"): trinafstand redigerbar; antal, trinlængde og H vises beregnet | `tabSite.js:624-655` |
| Label på kortet | **Findes ikke** — kun stolper (A, B, …) og forbindelser (A–B) har labels; armgangen er anonyme streger | `redraw()` i `tabSite.js` |

Vigtig eksisterende invariant: bar-højder klampes allerede til `min(stolpehøjde A, stolpehøjde B)` (`tabSite.js:493`), så armgangens højde er i dag *indirekte* begrænset af stolperne — men kun via barerne, og det er usynligt for brugeren.

## 2. Krav → designændringer

### Krav A: Man skal kunne bestemme retningen

I dag vælger `monkeySnap` selv bar-parret, og trinnene løber altid vinkelret fra bar A mod bar B. Forslag:

1. **Eksplicit valg af bar-par i skemaet:** de to kolonner `connA`/`connB` bliver dropdowns med alle forbindelses-labels (A–B, C–D, …), så man kan flytte armgangen til et andet gyldigt par uden at trække på kortet. Ugyldige par (fejler `monkeyPlacementValid`) vises disabled eller med ⚠.
2. **Retnings-cyklus ved placering:** mens spøgelses-armgangen vises, kan man trykke `R` (eller scrolle/klikke på en lille pil-knap) for at bladre mellem alle gyldige bar-par nær musen i stedet for kun det nærmeste. `monkeySnap` udvides til at returnere en sorteret kandidatliste frem for kun det bedste match.
3. **Flip af trin-retning:** nyt felt `flip: boolean` der bytter A/B, så trin-nummerering og margen-placering kan spejles (relevant for skæve/trapezformede par, hvor overlappet ikke er symmetrisk).

### Krav B: Trinnene skal hæfte i begge sider → maks-højde = laveste bærende stolpe

Trinnene hæfter geometrisk allerede i begge barer (hvert trin går fra bar A til bar B). Det der mangler, er en **eksplicit, redigerbar højde** med den rigtige grænse:

1. Nyt felt `height_m` på armgangen (migration: default = nuværende afledte `min(barhøjder)`).
2. **Klampning:** `height_m ≤ min(højden af alle 4 bærende stolper)` — dvs. stolperne i begge ender af *begge* barer. Hjælper: `monkeyMaxHeight(design, at)` i `model.js` (ren funktion, deles af kort/3D/print).
3. Når brugeren ændrer armgangens højde i skemaet, sættes **begge barers `height_m` til samme værdi** (klampet som ovenfor). Det gør kravet "hæfter i begge sider" fysisk sandt: trinnene sidder i samme kote i begge ender, og højdeforskellen (`hdiff`) bliver 0. Alternativet (lad barerne beholde forskellig højde og vis kun min) er forkastet, fordi skæve trin er netop dét, valideringen `hdiff ≤ 0.3` prøver at undgå.
4. Input-feltet får `max`-attribut + title-hint som stolpe/bar-felterne allerede har (mønster: `tabSite.js:589-592`).

### Krav C: Skema til højre med stige-parametre

Skemaet findes (afsnittet "Armgange"), men udvides fra 4 til ca. 7 kolonner/felter:

| Felt | Type | Regel |
|---|---|---|
| # / Label | vises (ny label, se krav D) | — |
| Bar-par (connA × connB) | 2 dropdowns | kun gyldige par |
| Trinafstand | input (findes) | ≥ 15 cm |
| Højde H | **input (nyt)** | 0 ≤ H ≤ laveste bærende stolpe; skriver til begge barer |
| Antal trin × trinlængde | beregnet (findes) | — |
| Flip retning | knap/checkbox (nyt) | — |

Ved valg af armgang på kortet scroller/highlightes rækken (samme mønster som forbindelser).

### Krav D: Label på kortet

Armgange får labels i stil med forbindelsernes: **M1, M2, …** (indeks i `attachments` filtreret på type). Implementering:

1. Hjælper `monkeyLabelOf(design, at)` i `model.js` ved siden af `connLabelOf`.
2. I `redraw()` (kun når `!live`, som for forbindelser) tegnes en ellipse-badge midt på armgangen (`g.mid` findes allerede i `monkeyGeometry`) med teksten "M1", roteret læsbart med den eksisterende `readableDeg`-hjælper.
3. Samme label bruges i skemaet th., i print (`print.js:36-43`, hvor armgangen i dag er anonyme streger) og i materialelisten.
4. Den lodrette stige (`ladder`) bør samtidig få labels **S1, S2, …** for konsistens.

## 3. Datamodel og migration

```js
// attachments, type:'monkey' — før
{ id, type:'monkey', connA, connB, spacing_m }
// efter
{ id, type:'monkey', connA, connB, spacing_m, height_m, flip }
```

- `schemaVersion` forbliver 1 hvis felterne gøres valgfrie med afledte defaults (anbefalet — `sanitizeSiteDesign` udfylder dem), ellers bump til 2 med migration i `saveload.js`.
- `sanitizeSiteDesign` (`tabSite.js:36-64`) udvides: `height_m` klampes til `[0, monkeyMaxHeight(...)]`, `flip` tvinges til boolean.

## 4. Berørte filer

| Fil | Ændring |
|---|---|
| `src/core/model.js` | `monkeyMaxHeight`, `monkeyLabelOf`, `flip`-understøttelse i `monkeyGeometry`, brug `at.height_m` i `g.y` |
| `src/ui/tabSite.js` | skema-udvidelse, label-tegning, retnings-cyklus i ghost, sanitering |
| `src/ui/tabView3d.js` | trin-kote fra `at.height_m` i stedet for afledt min |
| `src/ui/print.js` | M-labels på armgange |
| `src/ui/tabMaterials.js` | M-labels i stykliste |
| `src/core/locales/da.js` + `en.js` | nye nøgler: `site.monkey.height`, `site.monkey.pair`, `site.monkey.flip`, `site.monkey.heightMax`, … |
| `tests/tests.js` | tests for `monkeyMaxHeight`, klampning, label-generering, flip-geometri |

## 5. Etaper

1. **Etape 1 – labels (lille, ingen migration):** M-labels på kort, skema, print, stykliste. Også S-labels på lodrette stiger.
2. **Etape 2 – højde:** `height_m`-felt + `monkeyMaxHeight`-klampning + skriv-til-begge-barer + 3D.
3. **Etape 3 – retning:** dropdowns for bar-par, `R`-cyklus ved placering, `flip`.
4. **Etape 4 – tests + docs:** enhedstests af de nye rene funktioner i `model.js`; opdater README/PLAN.

Etaperne er uafhængigt leverbare og i stigende risiko-rækkefølge.

## 6. Forslag til yderligere tiltag (valgfrit)

1. **Styrkeberegning af armgangens trin:** trinnene er 1"-rør (`tabView3d.js:371`), men de indgår ikke i kritisk-markeringen. Kør `beam()` på trinlængden med referencelasten og markér røde trin — et 1,6 m trin i 1"-rør er reelt for slapt til en voksen.
2. **Aflastnings-effekt:** en armgang stiver de to barer af (mange støttepunkter). Overvej at lade armgangen reducere barernes effektive spænd i `effSpanOf` ligesom stiger gør (`tabSite.js:238-247`) — eller dokumentér bevidst hvorfor ikke.
3. **Skrå armgang ("uneven monkey bars"):** tillad bevidst `hdiff > 0` med et hældnings-felt, når begge barer stadig er inden for stolpegrænsen — populært til progression. Kræver kun at valideringens `hdiff ≤ 0.3` gøres konfigurerbar.
4. **Variabel trinafstand / forskudte trin:** felt for "forskydning pr. trin" (zigzag) — meget brugt i street workout-parker.
5. **Klik-hjælp:** når spøgelset er rødt (ugyldigt), vis en kort tekst i hjælpelinjen om *hvorfor* (ikke parallel / for langt mellemrum / optaget plads) i stedet for kun farven.
6. **Afrunding af trin-antal:** `monkeyGeometry` bruger fast 12 cm endemargin; gør den konfigurerbar sammen med beslags-typen (kee-klemmer vs. gennemboring) så styklisten passer til virkeligheden.
