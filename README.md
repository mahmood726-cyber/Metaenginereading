# Meta-Engine Pro (M6)

A single-file, **fully offline** meta-analysis dashboard. It imports per-study
JSON dockets (with a constitutional pass/fail gate), pools effect sizes
(hazard / odds / risk ratios) on the **log scale** with inverse-variance
fixed-effect and DerSimonian–Laird random-effects models, an optional
Hartung–Knapp–Sidik–Jonkman (HKSJ) small-sample adjustment, and a t-based
prediction interval — then draws an interactive forest plot you can export as SVG.

**Live app:** open `index.html` (or the GitHub Pages link). No build step, no
network, no external CDN.

## Layout

```
index.html    single-file UI (loads tailwind.js, then engine.js)
engine.js     pure statistical core — runs in Node and the browser
tests.js      Node test harness, 52 assertions
tailwind.js   vendored Tailwind Play CDN (self-contained in-browser JIT; offline)
LICENSE       MIT
```

## Statistical core (`engine.js`)

| Symbol | What it does |
|---|---|
| `Stats.normalCdf(x)` | standard normal CDF (Zelen–Severo); `Φ(0)=0.5`, `Φ(1.96)=0.975` |
| `Stats.normalQuantile(p)` | inverse normal / probit (Acklam) |
| `Stats.tCritical(df, alpha)` | two-sided Student-t critical value (exact table df 1–30, Cornish–Fisher beyond) |
| `MetaEngine.prepareData(studies)` | validation gate + log-scale effect/SE extraction from each docket |
| `MetaEngine.pool(data, model, useHksj)` | FE / DL-RE pooling, Q, I², τ², HKSJ variance inflation |
| `MetaEngine.formatResult(...)` | back-transforms to the ratio scale, CI, p-value, prediction interval |

Pooling is always done on the log scale and back-transformed (avoids the
natural-scale random-effects Simpson's-paradox trap). `τ² = max(0, (Q−(k−1))/C)`
with `C = ΣW − ΣW²/ΣW`; `I² = max(0, (Q−(k−1))/Q)`; the HKSJ variance carries
the standard floor `max(1, q)·Var_RE` and uses a `t_{k−1}` critical value.

## Fixes applied during revival (2026-06-05)

- **Made fully offline.** Tailwind was loaded from `https://cdn.tailwindcss.com`
  and Font Awesome from a `cdnjs` `<link>`. Tailwind is now vendored as
  `tailwind.js` (the self-contained Play-CDN JIT compiler, ~407 KB, works
  offline once vendored); the Font Awesome CDN was removed (decorative icon
  `<i>` tags degrade to empty inline elements). The page now loads **no**
  external resource.
- **Extracted the statistical core** into a pure `engine.js` (single source of
  truth). The inline `Stats` object and the pure `MetaEngine` methods
  (`prepareData`, `pool`, `formatResult`) were moved verbatim; the page now
  loads `engine.js` and only the DOM renderer + UI remain inline.
- **Fixed a correctness bug in `tCritical`.** The original (a mis-coded Hill 1970
  form) multiplied its leading term by `df`, so the t critical value *grew* with
  df — e.g. `df=2 → ~23.6`, `df=30 → ~61` — instead of converging to ~1.96. That
  inflated every HKSJ confidence interval and every prediction interval by one to
  two orders of magnitude. It is now an exact two-sided 0.975 lookup table for
  df 1–30 (matches `qt()` to 3 dp) plus a Cornish–Fisher expansion for df > 30.
  The pooling math (`normalCdf`, `normalQuantile`, Q, I², τ², weights) was
  verified correct and left unchanged.
- Added `tests.js` (52 assertions, all passing) and the Pages scaffold
  (`.nojekyll`, `.gitignore`, this README); renamed `metaenginereading.html` →
  `index.html`.

## Tests

```
node tests.js
# 52 passed, 0 failed
```

Checks include normal-CDF reference points (`Φ(0)=0.5`, `Φ(1.96)=0.975`), the
t-critical table and its monotone-decreasing-in-df / convergence-to-1.96
behaviour (the canary for the old bug), a hand-worked two-study fixed-effect
pooling (effect 0.7849, CI [0.719, 0.857], Q=1.2905, I²=22.5%), the matching
DL random-effects τ²=0.001186, a single-study (k=1) passthrough, a
two-identical-studies case (Q=0, I²=0, τ²=0), an HKSJ/prediction-interval
case (CI wider than the normal-RE CI; PI wider still and finite), and empty
guards. Every expected value is hand-derived independently of `engine.js`.

## Caveats

DerSimonian–Laird under-estimates τ² for small *k* (REML / Paule–Mandel are
preferred for k < 10); this dashboard preserves the original method for
continuity and reports τ² and I² alongside every estimate. SEs are reconstructed
from reported 95 % CIs under a normal-approximation assumption. Treat pooled
ratios as a synthesis aid, not a clinical decision rule. MIT licensed.
