# Four-sided city, interiors, traffic and volumetric cloud pass

## Implemented
- Preserved existing store business layout and component work. Four-sided city context now includes six low-rise, open-front/roofless southern interior samples and 17 far background masses in addition to the prior 28 buildings. Southern avenue connects both side streets.
- Interior samples contain actual floor, wall, partition, counter/POS, shelves/stock and table/chair geometry. They are deliberately simple architectural cutaways, not detailed interiors for every tower.
- Original procedural 256² ground texture blends paving/grass/grain outside modelled streets, with no external asset or licensing dependency. This is not aerial photography or a real neighbourhood map.
- 16 synthetic cars circulate in two separated lanes on the store's perimeter ring, using three instanced draw calls. Deterministic exterior-only trajectories; same-lane separation tested. Continuous ring, no junction, pedestrian, signal, collision or car-following solver. Right-angle corner motion remains simplified. Manual pause, reduced-motion pause and background-tab suspension implemented.
- Replaced solid cloud lobes with actual bounded 3D density ray marching: 24/48 view samples, Beer–Lambert attenuation and three directional light samples for approximate self-shadow. Cloud volume off/low/high controls. Static field; not Navier–Stokes, a weather forecast, multiple scattering, or physically validated atmosphere.
- Added whole-scene economy/fine switch: economy 0.85 DPR, shadows off; fine 1–1.5 DPR and shadows. Cloud and traffic controls separate from scene quality.
- Fixed observed distant-road/window depth fighting by lowering the terrain plane, separating window strips and increasing camera near plane to 0.5m. Fixed metrics overlay integration after first runtime error and reverified actual scene.

## Actual cloud Firefox checks and performance
All values below are observed two-second frame-callback samples at 1364×1024, not GPU timers, guaranteed FPS, or controlled hardware benchmarks. Background tests/system load varied; do not present differences as a clean A/B improvement.
- Final economy whole city, low cloud: about 8.3–8.9 fps, 40 draw calls, 898k reported triangles.
- Final economy skyline, high cloud: 8.2 fps, 37 draw calls, 898k reported triangles.
- Economy skyline, clouds off: 8.1–9.9 fps, 35 draw calls, 898k reported triangles.
- Interior close-up: 23.9 fps, 9 draw calls, 64k reported triangles.
- Earlier fine/full-store sample was 5.4 fps; temporary loaded runs dipped to 3.1 fps. This is not a smooth-30fps acceptance. Main-store geometry remains the major optimization target; cloud-off alone does not remove that cost.
- Actual pause UI showed “已静止”; actual car positions changed across live snapshots. Both low and high volumetric shader modes rendered, and off removed them. Reduced motion covered by UI test rather than OS screenshot.

## Screenshots
In shared browser QA directory, unedited native Firefox page captures:
- 2026-11-18 02-08-42: final four-sided city / traffic / ground, metrics visible.
- 2026-11-18 02-09-04: interior with runtime metrics.
- 2026-11-18 02-09-45: fine volumetric cloud skyline with runtime metrics.
- 2026-11-18 02-12-14: final fine cloud skyline with traffic paused.
- 2026-11-18 02-12-37: final interior with traffic paused.

## Validation and limits
Full check passed: 62 root suites, 555 tests; 3 web suites/tests. Final depth fixes followed by typecheck and 7 targeted tests. Production build passed with existing bundle-size warning. Diff whitespace check clean; original staged tree unchanged. No push, merge or deployment.

This is still stylized low-poly modelling, not photorealistic acceptance. Distant boxes, repeated facades, synthetic ground texture, shallow interior detail and ring-only traffic remain explicit limitations. More realistic facade/material variation, camera-dependent store LOD and cached/low-resolution cloud compositing are further work, not completed claims.
