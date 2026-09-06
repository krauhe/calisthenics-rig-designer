# Review fixes, 6 September 2026

The review covered the current project including the existing changes to saw
kerf and dimensioned prints. Those changes are preserved.

## Corrected

1. Import rejects unsafe/duplicate identifiers. SVG attributes and printed
   material names are escaped independently as defence in depth.
2. Unrelated JSON documents cannot replace a drawing or its autosave.
3. The post-tool preview derives its own post size instead of an out-of-scope variable.
4. 3D uses individual post sections/materials, including round pipe posts,
   timber treatment and face offsets. Printed 3D uses the same renderer.
5. Live edits and reloads share connection-height limits, retaining desired heights.
6. Map labels show clear lengths, consistent with the connection table.
7. Materials exposes pipe-type default walls and catalogue reset. Individual
   connection overrides remain independent through changes and reloads.
8. Sloping monkey-bar rungs reach both supports; cutting lengths include vertical
   rise, and the bill of materials accounts for adjustable fittings.
9. Both the local multi-file app and the standalone file include Three.js for
   offline file-URL use. The standalone needs no adjacent vendor directory.
10. Service-worker cleanup and fallback access only this app's caches.
11. Printed cutting-list text converts metres to the selected display unit.
12. Remaining stock excludes saw kerf, rather than counting it a second time.
13. Saw-kerf, stock-length, wall and ladder-spacing edits retain usable decimal entry.
14. Explicit 300 mm foundation defaults survive reload; only missing values inherit
    the current default.

Additional corrections: independent undo steps for distinct actions, keyboard
access to both tab groups, responsive labelled table rows with visible deletion,
and camera framing that adapts to the rig's bounds and viewport.

The former "safe working load" wording is now an estimated member bending limit,
with explicit model limitations. This is not external engineering validation;
actual joints, dynamics and whole-structure safety still require professional review.

## Regression coverage

- 170 core tests, including malformed import, dimension round trips, independent
  wall overrides, saw-kerf accounting and three-dimensional rung lengths.
- State tests cover undo/redo, field-specific coalescing and autosave.
- Service-worker tests preserve unrelated cache entries.
- Generated scripts are syntax checked and compared with the source bundle;
  Danish/English translation keys must match.
- Isolated browser tests cover drawing interactions, invalid imports, injection
  attempts, wall defaults/reset, decimal input, keyboard navigation, print units,
  offline 3D, actual mesh dimensions, moving/nonblank canvas pixels and framing.
- Table layouts are checked at 390, 768, 1440 and 1920 px in Danish and English.

Run `python build.py`, `npm test` and `npm run test:browser`. Browser prerequisites
and environment overrides are documented in the README. GitHub Actions runs all
three stages; tests do not access the user's real browser profile or saved designs.
