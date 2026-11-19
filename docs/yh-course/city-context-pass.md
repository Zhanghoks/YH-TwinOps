# Generic city context pass

- Added 28 low-poly buildings: near side blocks, north street frontage and a taller second-row skyline. Each has a base, roof cap, rooftop equipment and inexpensive window bands, batched with existing architecture.
- Added a background avenue, cross streets and green verges. Southern foreground is intentionally unobstructed to preserve cutaway store readability.
- Added 48 low-poly cloud lobes in 16 static groups around the sky dome, with sunny/overcast/rain colours. Clouds sit outside the main site camera orbit; reduced motion requires no additional animation.
- Added “城市天际线” near-horizontal camera preset. This is generic visual context, not a surveyed real neighbourhood, and weather remains explicitly simulated/non-live.
- All component geometry, layout IDs and existing edits retained. No push, merge or deploy.
- Limits: simple opaque window strips, no building interiors/traffic simulation/physical volumetric atmosphere; frame rate not benchmarked.

Validation: `npm run check` passed (60 root suites / 550 tests, 3 web tests); final web production build passed, existing bundle-size warning remains. Typecheck rerun passed after adding cloud lighting. `git diff --check` clean. Cloud material then received a visual-only emissive/smoothing adjustment, verified by final build and Firefox capture. No measured FPS claim.

Actual Firefox captures (shared browser QA directory):
- 2026-11-18 01-26-58: city full-site composition; surrounding blocks visible, shop floor readable.
- 2026-11-18 01-28-39: final sunny near-horizontal skyline and illuminated 3D clouds.
- 2026-11-18 01-28-57: final rain skyline, paused rain effect; indoor merchandise remains visible.

Visual check corrected excessively dark cloud undersides with diffuse fill and smoother normals. Skyline materials remain intentionally coarse; near-horizontal view is for background review, not full-floor inspection.
