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
const TAR_BOTTOM = -0.5; // tjære fra 0,5 m i jord ...
const TAR_TOP = 0.10;    // ... til 10 cm over jord

// Skæreplan
const STOCK = 6.0;       // standard stanglængde ved indkøb (m)
const KERF = 0.004;      // savsnit pr. snit (m)
