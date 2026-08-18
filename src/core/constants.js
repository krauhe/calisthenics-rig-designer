// Faste fysiske konstanter og standardantagelser for hele appen.
// ENHEDER: alt internt i SI — meter (m), Newton (N), Pascal (Pa).
// Tværsnitsdimensioner angives i millimeter (mm) i datamodellen og
// konverteres til m inde i sections.js.

const G = 9.81;          // tyngdeacceleration (m/s²)

// Materialeantagelser (kan overstyres pr. element via member-objektet)
const E_WOOD = 10e9;     // E-modul, trykimpr. fyr C24 (Pa) — pælens egen bøjning
const K_SOIL = 20e6;     // vandret reaktionsmodul, medium/fast jord (N/m³)

// Forbindelsernes indspænding i Kee-fittings:
// 0 = frit oplagt, 1 = helt fast indspændt. 0,25 = anslået for klemfittings.
const FIXITY = 0.25;

// Standard-geometri (kan overstyres pr. stolpe)
const POST = 0.125;      // standard stolpe 12,5×12,5 cm (m)
const POST_ABOVE = 3.0;  // standard stolpehøjde over jord (m)

// Fundament-zoner
const GRAVEL_H = 0.10;   // småsten i bunden af hullet (m)
// Tjære-zone: hele den nedgravede del + 20 cm over jord — samme zone som
// print-vejledningen instruerer ("fra ca. 20 cm over jord til bunden").
// Bunden er stolpens egen nedgravningsdybde (pr. stolpe), derfor ingen fast konstant.
const TAR_TOP = 0.20;    // jordlinjebånd: 20 cm over færdig jord (m)
const TAR_BOTTOM = 0.20; // jordlinjebånd: 20 cm under færdig jord (m)

// Stigens separate, runde fundament. Værdierne gemmes pr. stige, så flere
// stiger kan have forskellige forhold på samme rig.
const LADDER_FOOT_DEPTH_M = 0.50;
const LADDER_FOOT_HOLE_MM = 220;
const LADDER_RUNG_SPACING_M = 0.40;

// Skæreplan
const STOCK = 6.0;       // standard stanglængde ved indkøb (m)
const KERF = 0.004;      // savsnit pr. snit (m)
