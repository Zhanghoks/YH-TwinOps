# Rendering LOD optimization and controlled-view comparison

## Diagnosis
The starting candidate full-city view reported 898k triangles and 40 draw calls. Draw batching was already efficient; rendering every tiny product surface and physically based bump/roughness material at overview scale was wasteful. Disabling clouds alone had not removed the main cost.

## Changes
- Per-fixture camera-distance LOD with 45/60m hysteresis. Full geometry is constructed once and cached; it is not rebuilt on traffic animation ticks. Nearby, selected and design-sample fixtures keep all detail and their original IDs.
- Far product spheres use 8-triangle octahedra rather than 80-triangle spheres. Far opaque materials use diffuse mapped Lambert shading instead of PBR roughness/bump sampling.
- Far mode drops named auxiliary neck/cap/leaf/score/pack-label/stripe/vent parts and subpixel labels/hardware, not primary product bodies, produce beds or fixture categories. Approaching restores them.
- Economy mode only: safe distant opaque boxes draw the top and camera-facing side faces (6 rather than 12 triangles). Original vertex positions, normals and UVs retained. Local fixture rotation is accounted for. Full boxes remain for glass, near/selected fixtures, cameras below the fixture top or within its X/Z extent. Fine shadow mode uses complete boxes so invisible caster faces are not removed.
- Conservative face quadrant changes may raise draw calls; this is an explicit geometry-vs-batches tradeoff rather than a claim of lower call count.

## Same-environment / same-view measurements
Cloud native Firefox, 1364×1024, reference 130×100 layout, model-focused, labels off, “场景全景” preset, sunny, economy quality (0.85 DPR / shadows off), low volumetric cloud, moving traffic. No builds/tests running during the final comparison samples. Metrics are observed two-second frame-callback windows, not GPU timing or percentile benchmarks.

| Stage | Observed fps | Draw calls | Triangles |
|---|---:|---:|---:|
| Before this pass | 9.9, 10.0 | 40 | 898k |
| First sphere/material LOD | 13.8 | 40 | 361k |
| Final micro-detail + safe visible faces | 18.3, 19.1, 17.2 | 45 | 200k |

The final count is about 78% lower and sampled throughput about 1.7–1.9× the immediate baseline. It is still below smooth 30fps. Do not equate this with performance acceptance on all hardware or claim the 30fps invalidation timer is achieved FPS. Further major work could include cached static rendering or carefully designed far merchandise atlases; neither is implemented here.

## Visual and interaction checks
- Actual before/after full-city captures retain store arrangement, product density, surrounding streets/buildings, cloud/weather controls and moving vehicles. No visible missing box sides observed in the tested view.
- Actual baseline fixture click selected F136 (CHECKOUT), showed original dimensions/data, and highlighted it. Selected fixture uses full detail.
- Actual standalone vegetable sample retained small leaves, three display tiers, supports and wood material. Samples bypass far LOD even when viewed from farther away.
- Pure tests cover original near arrays, untouched source data, preserved primary merchandise, hysteresis/distance, selected/sample exemptions, rotated face selection and conservative full-box fallback.

## Evidence and validation
Unedited Firefox captures in shared QA directory:
- 2026-11-18 02-15-04: before, matching full-city benchmark.
- 2026-11-18 02-22-16: final after, matching full-city benchmark.
- 2026-11-18 02-23-31: F136 selection regression.
- 2026-11-18 02-23-52: full-detail vegetable sample regression.

Full check: 63 root suites / 562 tests, plus 3 web suites/tests. Final compact-face changes also passed Web typecheck and 7 targeted tests. Production build and diff checks passed. Existing bundle-size warning remains. Original staged tree preserved. No push/merge/deploy.
