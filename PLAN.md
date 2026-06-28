# Plan: Calisthenics Rig Designer 2.0

Dette er arbejdsdokumentet for ombygningen fra den nuværende ene fil
(`chalestetics-3d.html`) til en mere fleksibel og lækker udgave med faner.

Skrevet til at kunne læses uden at kunne kode. Du styrer retningen og
specificerer detaljer; jeg implementerer. Vi rører **ikke** kode, før du har
sagt god for planen.

---

## 1. Hvad vi bygger

I dag: én fast firkant med 4 stolper, faste mål, ét beregningssæt.

Målet: et lille **tegne- og beregningsprogram** for calisthenics-stativer, delt op i faner:

1. **Stolpe-analyse** – analysér én stolpe: dybde, dimension, højde, materiale (træ eller jernrør). Ud kommer: hvor meget den svajer, stivhed, bæreevne.
2. **Bar-analyse** – analysér en vandret bar: en **graf** over opførsel afhængigt af materiale og dimension (Ø + godstykkelse for rør, sidemål for træ).
3. **Kort** (set ovenfra) – placér stolper frit, forbind dem, vælg materiale + højde på forbindelserne. Et **tegneprogram** med en værktøjspalette i venstre side.
4. **3D** – som den nuværende visning, med info når man holder musen over.
5. **Materialeliste** – indtast hvilke længder du køber materialerne i; ud kommer en visuel **skærevejledning** (som den nuværende).

Gennemgående:
- **To sprog:** dansk + engelsk, kan skiftes.
- **Enheder pr. fane:** metrisk eller tommer (Ø/dim), og meter eller fod (længder) – uafhængigt på hver analysefane.
- **Materialebibliotek:** gem dine egne standardmaterialer (fx "10×10 stolpe", "1\" vandrør") og genbrug dem.
- **Auto-gemt lokalt:** programmet åbner præcis som du forlod det.
- **Gem/del tegninger som filer:** så du kan sende en tegning til andre.

---

## 2. Den tekniske beslutning (kort, i klart sprog)

**Valgt: almindelig JavaScript + en ren "regnekerne" + et lille værktøj kaldet Vite. Intet framework.**

Hvorfor (kort): det er den letteste at vedligeholde for én person over år, det
beskytter den vigtige matematik bedst, og det deployer stabilt til GitHub Pages.
Tre uafhængige "dommere" sammenlignede fire tilgange; denne vandt samlet. De to
alternativer (helt uden byggeværktøj / et moderne framework som Svelte) var hver
især enten for skrøbelige at teste eller for meget nyt at lære og vedligeholde.

**Vigtigt princip:** matematikken (styrke, nedbøjning, fundament, skæreplan)
lægges i en **"kerne", der intet ved om hverken skærm eller 3D**. Så kan den
testes automatisk og genbruges på alle faner – og overleve selvom udseendet
skiftes ud igen senere (dette er allerede 2. gang vi laver udseendet om).

### Mini-ordbog

| Ord | Hvad det betyder her |
|---|---|
| **Modul** | En lille kodefil med ét ansvar (fx kun matematik for bjælker). Mange små filer i stedet for én stor. |
| **Kerne / engine** | Modulerne med ren matematik og data – ingen skærm, ingen 3D. Den værdifulde del. |
| **Vite** | Et hjælpeværktøj på din computer, der samler modulerne og giver "live-reload" mens jeg arbejder. Kræver Node installeret. |
| **Build / deploy** | "Build" = pak koden til en færdig hjemmeside. "Deploy" = læg den på nettet (GitHub Pages). |
| **SI-enheder** | Vi regner altid i meter/millimeter/Pascal indeni. Tommer/fod er kun til visning. |
| **Graf** | Stolper = punkter, forbindelser = streger imellem dem. Den faste firkant bliver bare ét eksempel på sådan en graf. |
| **Schema-version** | Et versionsnummer i de gemte filer, så gamle delte tegninger stadig kan åbnes når formatet udvikler sig. |
| **Autosave** | Gemmer automatisk i browseren, så intet går tabt mellem besøg. |
| **Escape hatch** | En "nødudgang": fordi vi ikke binder os til et framework, kan koden køres uden Vite igen, hvis Vite en dag bliver besværligt. |

---

## 3. Mappestruktur

```
calisthenics-rig-designer/
  index.html              app-skal: fanebjælke + paneler
  package.json            kommandoer: dev, build, preview, test
  vite.config.js          base:'/calisthenics-rig-designer/'   ← GitHub Pages-stien
  jsconfig.json           typehints i editoren, uden compile-trin
  .github/workflows/deploy.yml   bygger + lægger på Pages ved hvert push
  README.md · LICENSE · PLAN.md

  src/
    core/        ← REN logik. INGEN skærm, INGEN 3D. Det uerstattelige.
      constants.js    G, E_WOOD, K_SOIL, FIXITY, GRAVEL_H, TAR_*, STOCK, KERF
      units.js        konvertering mm↔tomme, m↔fod + visning (dansk komma)
      sections.js     tværsnit: I og Z for rør/træ (fra dine SIZES)
      mechanics.js    bjælke: nedbøjning + bæreevne (din mechanics(), parametriseret)
      foundation.js   pæl/fundament-stivhed (din foundation(), parametriseret)
      model.js        design-objektet + resolvePost() (arv af defaults)
      cutplan.js      skæreplan (din bin-packing, stock-længde som parameter)
      materials.js    materialeoptælling (beton, grus, tjære, rør, fittings)
      library.js      brugerens gemte standardmaterialer
      store.js        samlet tilstand + autosave
      schema.js       schema-version + migrate() til gem/load
      i18n.js         t(nøgle) + sprogskift
      locales/da.js · locales/en.js   teksterne

    ui/          ← tynd skærm-del, ét modul pr. fane
      tabs.js · controls.js · chart.js · cutguide.js · toolbar.js
      tabPost.js · tabBar.js · tabSite.js · tabView3d.js · tabMaterials.js
      settings.js · saveload.js

    three/       ← 3D-visning, læser modellen – ejer ingen logik
      scene.js · builders.js · picking.js

  tests/         ← automatiske tests der "låser" matematikken
    mechanics.test.js · sections.test.js · foundation.test.js
    cutplan.test.js · units.test.js · schema.test.js

  examples/
    default-4post.json   din nuværende rig som delbar prøve-fil
```

Ca. 25 små filer i stedet for én på 780 linjer. Hver fane kan forstås for sig.

---

## 4. Datamodellen (kernen i fleksibiliteten)

Alt om en tegning samles i **ét objekt**, der auto-gemmes og kan gemmes som fil.
Den faste firkant bliver bare **ét særtilfælde** af en fri graf af stolper og forbindelser:

```js
design = {
  schemaVersion: 1,
  meta:     { name, created, modified },
  settings: { lang: 'da' | 'en' },

  // enheder uafhængigt pr. fane:
  units:    { post: { len:'m'|'ft', dim:'mm'|'in' },
              bar:  { len:'m'|'ft', dim:'mm'|'in' },
              site: { len:'m'|'ft' } },

  // Tab-1 værdier; hver stolpe arver disse, med mindre den overstyrer:
  defaults: { post: { material:<ref>, dim_mm, wall_mm?, depth_m, hole_mm, heightAbove_m },
              soil: { kSoil },
              load: { centerKg, fixity } },

  posts:       [ { id, x_m, z_m, override: null | { …delmængde af post } } ],
  connections: [ { id, a, b, height_m, material:<ref>, onTop? } ],
  attachments: [ { id, type:'ladder', postId, connectionId?, width_m } ],
  library:     [ { id, name, kind:'pipe'|'wood', od_mm?, wall_mm?, side_mm?,
                   E, sRe, sRm, builtin? } ],
  stock:       { '<materialnøgle>': længde_m }
}

// material<ref> = { source:'library', id }  ELLER  { source:'inline', def:{…} }
// resolvePost(post) = flet(defaults.post, override)   // override = null → arver alt
```

Tre vigtige valg:
- **Alt gemmes i SI** (meter/millimeter/Pascal). Tommer/fod konverteres kun ved
  ind- og udlæsning på skærmen. Det gør dine to enhedssystemer pr. fane næsten
  gratis – og umuliggør enheds-fejl i beregningerne. Din nuværende matematik
  regner allerede i SI.
- **Materialer kan refereres med id ELLER skrives direkte ind ("inline").** Så
  en tegning du sender til en anden åbner korrekt, selvom de ikke har dit bibliotek.
- **Stigen er et "attachment" (påsat element)** – ikke hardcodet på side A som nu.
  Samme mekanik kan senere bære ringe, dip-barre osv.

---

## 5. Hvordan delene virker

**Enheder.** Skriver du 1 i tomme-tilstand, gemmes 25,4 mm. Skifter du fane til
fod, vises tallene om til fod – samme tegning, ingen omregning du selv skal lave.
Dansk komma (3,5 i stedet for 3.5) håndteres i visningslaget.

**Sprog.** To ordlister (da/en) med samme nøgler. Skift sprog → hele
brugerfladen skifter. Dansk er standard og "reserve", så en manglende engelsk
tekst aldrig giver et tomt felt.

**Gem/load + deling.**
- *Autosave:* hele design-objektet gemmes løbende i browseren; åbnes igen ved start.
- *Gem som fil:* download en `.json`-fil (fx `min-rig.json`) – ingen server, virker offline.
- *Hent fil:* vælg en fil, den tjekkes og opdateres til nuværende format, før den åbnes.
- *Schema-version + migrate():* gamle/delte filer kan stadig åbnes; ukendte/nyere
  versioner afvises pænt i stedet for at ødelægge noget. Din nuværende gemte rig
  (`chalestetics-3d` i browseren) importeres automatisk, så intet går tabt.

**Kort-fanen = tegneprogram.** Værktøjspalette i venstre side:
*vælg/flyt · sæt stolpe · træk forbindelse · placér stige · slet.* Klik værktøj →
klik på fladen for at placere. Gitter + "snapping", og tjek af om stolper ligger
på linje, før en forbindelse tillades.

---

## 6. Faseplan

Tommelfingerregel: **appen kan køre og lægges på nettet efter hvert skridt** –
ingen "alt om eller intet". Du kan stoppe efter en hvilken som helst fase og have
noget der virker.

| Fase | Hvad jeg laver | Hvad du ser bagefter |
|---|---|---|
| **0** | Frys nuværende fil som sikkerheds­baseline. Sæt Vite op *rundt om* den uændret. Sørg for at Dropbox ikke synker `node_modules`. | Samme app, nu i den nye struktur. Intet ændret visuelt. |
| **1** | Træk matematikken ud i `core/` som rene funktioner. Skriv tests der "låser" dagens tal. | Stadig samme app – men matematikken er nu testet og adskilt. |
| **2** | Fanebjælke. Flyt nuværende 3D + materialeliste + skæreliste ind i faner. | Appen ser ud som nu, men ligger i faner. Stadig fast firkant. |
| **3** | Design-objekt + autosave + gem/hent fil + schema-version. Importér din gamle gemte rig. | Du kan gemme/dele tegninger som filer, og den husker alt. |
| **4** | Stolpe- og bar-analyse-faner (med graf). Materialebibliotek. Enheder pr. fane. Dansk/engelsk. | De to analysefaner + sprog- og enhedsvalg + dit eget materialebibliotek. |
| **5** | **Den store:** fast firkant → fri graf. Kort-editor med værktøjspalette. Stige som element. 3D omskrives til at læse grafen. | Du kan tegne dit eget stativ frit oppefra og se det i 3D. |
| **6** | Materialeliste-fane med købslængde → skæreplan. Eksempel-fil. Finpudsning af udseende. | Komplet skærevejledning + et mere lækkert udtryk. |

Cirka-omfang: faser 0–2 er mekaniske og lav-risiko; fase 3–4 er ny, behagelig
funktionalitet; **fase 5 er den tunge** (grafen + kort-editoren + 3D-omskrivningen).

---

## 7. Konkrete kodefixes der SKAL med

Tekniske detaljer fundet i den nuværende kode, som skal rettes for at analyse­fanerne bliver korrekte:

1. **`foundation()` hardcoder de 12,5 cm** (`POST`) og læser globale værdier. For
   per-stolpe-analyse skal den tage stolpens mål som parameter
   (`postSide, depth, hole, topHøjde, E`) – ellers regner overstyrede stolper forkert.
2. **`mechanics()` læser global last og fast indspænding.** Last og indspændings­grad
   skal kunne sættes pr. element – ellers kan bar-analysens graf (opførsel ved given
   last) ikke regnes rent.
3. **Tværsnit ud i sit eget modul** (`sections.js`), så post-fane, bar-fane, kort og
   materialeliste bruger samme kode.
4. **Materiale skal ikke længere være "nummer i en liste"** (skrøbeligt) men en
   stabil reference eller inline-definition.
5. **Skæreplan skal tage købslængde som parameter** i stedet for fast 6 m.
6. **Tests skal tjekke uafhængigt håndregnede værdier** på de centrale formler –
   ikke bare gentage hvad koden nu giver. (Vigtigt: folk hænger deres kropsvægt i det.)

---

## 8. Ekstra overvejelser (svar på "er der andre?")

**Foreslået med fra start:**
- **Vendor three.js lokalt** (eller signaturtjek) → siden dør ikke hvis CDN'en ryger; virker offline.
- **Fortryd/gentag** – næsten gratis når tilstanden er ét objekt; et tegneprogram har brug for det.
- **Sikkerhedsfaktor synlig** (×2 dynamisk ved sving) + antagelserne (FIXITY=0,25,
  K_SOIL, E_WOOD) skal blive ved med at være tydeligt mærket, nu hvor tallene bliver mere fremtrædende.
- **Grafsikring:** NaN-vagter, tolerance på "ligger på linje", håndtering af
  hængende/sammenfaldende stolper.
- **`node_modules` ud af Dropbox-sync** (selective sync) – *ikke* flytte repoet, bare
  undgå at Dropbox synker tusindvis af filer. Eneste reelle Dropbox-fælde her.

**Senere / valgfrit (ikke nu):**
- Del via URL (tegningen pakket ind i et link) udover filer.
- Print-venlig PDF af materialeliste + skæreplan til byggedagen.
- Touch/mobil-venlig kort-editor.
- "Installér som app" / fuld offline (PWA).

---

## 9. Hvad jeg får brug for fra dig undervejs

Du behøver ikke kunne koden – men nogle valg er dine:
- **Standardværdier** til Tab-1 (samme som nu, eller nye?).
- **Hvilke materialer** der skal ligge i biblioteket fra start (ud over dine nuværende 3/4", 1", 1¼", 10×10 træ).
- **Engelske tekster:** jeg oversætter, du retter hvis noget lyder forkert.
- **Udseende/polish:** farver, layout, "lækker"-retning – især i fase 5–6.

---

## 10. Status

- [x] Arkitektur besluttet: vanilla + Vite + ren kerne.
- [x] Denne plan skrevet.
- [x] Ansvarsfraskrivelse tilføjet (app + README).
- [x] **Fase 1 færdig:** regnekernen (`src/core/`) som browser-native ES-moduler + 30 tests (håndregnet + parity). Alle består.
- [x] **Fase 2 færdig:** fane-skal (`app.html` + `src/main.js`) med da/en-skift, enheder pr. fane (m/fod + mm/tommer), materialebibliotek (med "tilføj"), **Stolpe-** og **Bar-analyse** (med kapacitets-graf), og autosave. Verificeret i browser. Kort/3D/Materialer er pladsholdere indtil senere faser.
- [ ] Fase 0-tooling (Vite) — **afventer at Node bliver installeret** (se note nedenfor). Appen kører fint build-frit imens.
- [ ] Faser 3–6 (gem/del-filer + schema, graf-model, kort-editor m. værktøjspalette + stige-element, 3D-omskrivning, materialeliste).

**Live (ny udgave):** https://krauhe.github.io/calisthenics-rig-designer/app.html — `index.html` peger stadig på den gamle app, indtil v2 er klar til at overtage.

### Node-note (vigtig)
Vite og de automatiske tests kører på **Node**, som ikke er installeret på maskinen endnu. Derfor:
- Kernen er bygget **browser-native** (rene ES-moduler), så den kører **uden** at installere noget — det er escape-hatch'en fra afsnit 2 i praksis.
- Testene kan køres på to måder: i en browser ved at åbne `tests/run-tests.html` (helt uden Node), eller med `node tests/node-run.mjs` når Node er installeret.
- Når du vil have dev-server (`npm run dev`) + build + auto-tests: installér Node LTS fra nodejs.org — så er `package.json` / `vite.config.js` allerede klar. Sig til, så guider jeg dig.

Matematikken i kernen er verificeret mod den nuværende apps tal (parity) og mod uafhængigt håndregnede værdier.
```
