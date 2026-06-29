// Pæl-/fundamentstivhed ved en vandret last i toppen af en stolpe.
//
// To bidrag til toppens sideflytning:
//   1) pælens EGEN bøjning som en udkraget bjælke:  δ = H·h³ / (3·E·I_pæl)
//   2) fundamentets DREJNING i jorden:              δ = (H·h/Kθ)·h
// hvor drejestivheden Kθ = k_jord · b · D³ / 3  (∝ bredde × dybde³).
//
// Alle længder i meter. Parametriseret, så hver enkelt stolpe kan have
// egne mål (sidemål, dybde, hul, højde) — den gamle udgave hardcodede
// 12,5 cm-stolpen.
//
//   postSide   stolpens sidemål (m)        — fx 0.125
//   depth      nedgravningsdybde (m)
//   hole       betonhullets sidemål (m)
//   topHeight  højde til øverste bar = momentarm (m)
//   Ipost      pælens inertimoment (m⁴), valgfri — fx for rør-stolper.
//              Hvis udeladt antages massiv kvadrat: postSide⁴/12.
//   E          pælens E-modul (Pa)         — default E_WOOD
//   kSoil      jordens reaktionsmodul      — default K_SOIL
//   refKg      reference vandret last (kg) — default 50


function foundation({ postSide, depth, hole, topHeight, Ipost,
                             E = E_WOOD, kSoil = K_SOIL, refKg = 50 }) {
  const Ktheta = kSoil * hole * depth ** 3 / 3;      // Nm/rad
  const Href = refKg * G;                            // N
  const Iw = Ipost != null ? Ipost : postSide ** 4 / 12;  // pælens inertimoment (m⁴)

  const dBend = Href * topHeight ** 3 / (3 * E * Iw);        // pælens egen bøjning (m)
  const dRot  = (Href * topHeight / Ktheta) * topHeight;     // top-flyt pga. drejning (m)
  const dTop  = dBend + dRot;                                // samlet (m)
  const kLat  = Href / dTop;                                 // samlet sidestivhed (N/m)

  return { Ktheta, dBend, dRot, dTop, kLat };
}
