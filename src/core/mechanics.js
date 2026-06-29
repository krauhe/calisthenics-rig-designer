// Bjælkemekanik: en vandret bar med en punktlast på midten.
//
// Forenklet håndberegning (ikke FEA):
//   nedbøjning   frit oplagt   δ = W·L³ / (48·E·I)
//                fast indspændt δ = W·L³ / (192·E·I)
//   realistisk = interpolation mellem de to via 'fixity' (0..1)
//   max moment  frit  M = W·L/4 ,  fast M = W·L/8  → samme interpolation
//   bæreevne    M = c·W·L = Z·σ   ⇒   W = Z·σ / (c·L)
//
// 'member' = geometri + materiale (dim i mm, E/sRe/sRm i Pa):
//   { kind:'pipe', od, wall, E, sRe, sRm } | { kind:'wood', side, E, sRe, sRm }
//   sRe = arbejds-/flydegrænse, sRm = brud-/maksgrænse.


function beam(L, member, loadKg, fixity = FIXITY) {
  const { I, Z } = sectionProps(member);
  const E = member.E;
  const W = loadKg * G;                       // last på midten (N)

  const dPin = (W * L ** 3) / (48 * E * I);
  const dFix = (W * L ** 3) / (192 * E * I);
  const dReal = fixity * dFix + (1 - fixity) * dPin;

  const cReal = fixity * (1 / 8) + (1 - fixity) * (1 / 4); // momentkoeff. på W·L
  const pYield = (member.sRe * Z) / (cReal * L) / G;       // kg ved arbejds-/flydegrænse
  const pUlt   = (member.sRm * Z) / (cReal * L) / G;       // kg ved brud

  return { I, Z, dPin, dFix, dReal, cReal, pYield, pUlt, kind: member.kind };
}
