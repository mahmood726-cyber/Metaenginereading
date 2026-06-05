# E156-PROTOCOL — Meta-Engine Pro (M6 Meta-Analysis Engine)

- **Project:** Metaenginereading (GitHub repo `Metaenginereading`, user `mahmood726-cyber`)
- **Revived:** 2026-06-05 (from a single-file `metaenginereading.html` dump titled "v15 Final")
- **Type:** single-file offline browser tool + Node-testable engine
- **Dashboard:** GitHub Pages (`index.html`)

## What changed in the revival

- Made **fully offline**: vendored the Tailwind Play CDN as `tailwind.js` and
  removed the Font Awesome `cdnjs` `<link>`; the app now loads no external
  resource (`grep` for `https://` in the HTML returns nothing).
- Extracted the statistical core into a pure `engine.js` (single source of
  truth); the inline `Stats` object and the pure `MetaEngine` methods were moved
  verbatim and the inline duplicates deleted, leaving only the DOM renderer + UI.
- **Fixed a correctness bug** in `tCritical` (a mis-coded Hill 1970 form whose
  value *grew* with df — ~23.6 at df=2, ~61 at df=30 — instead of converging to
  ~1.96), which had inflated every HKSJ CI and prediction interval by 1–2 orders
  of magnitude. Replaced with an exact df 1–30 table + Cornish–Fisher beyond.
- Added `tests.js` (52 assertions, all passing) and the Pages scaffold
  (`.nojekyll`, `.gitignore`, README); renamed `metaenginereading.html` →
  `index.html`. Dropped the "Final" claim.

## Body (E156 draft — CURRENT BODY)

Does the small-sample inference machinery of a browser meta-analysis engine
change its pooled conclusions, and was the shipped build trustworthy? The tool
imports per-study effect dockets behind a pass/fail gate and pools hazard, odds,
or risk ratios on the log scale. It fits fixed-effect and
DerSimonian–Laird random-effects models with an optional
Hartung–Knapp–Sidik–Jonkman adjustment, reporting Q, I², τ², a confidence
interval, and a t-based prediction interval on an exportable forest plot. A
revival audit found the shipped t-critical routine grew with the degrees of
freedom instead of shrinking toward 1.96, silently inflating every HKSJ and
prediction interval by one to two orders of magnitude. The fix restores an exact
small-df critical-value table, and the corrected core is locked behind a
52-assertion, fully hand-derived test suite. The honest read is that point
estimates were fine but uncertainty intervals were not, so interval claims from
the prior build should be recomputed. The tool is a transparent, fully offline
synthesis aid, not a clinical decision rule.

SUBMITTED: [ ]
