# Continuous urban fabric pass

Root visual issue: a finite pale plinth with scattered buildings and abruptly ending roads read as a display sandbox. This pass changes the connected scene structure, not only the building count.

- Added a continuous 64m street lattice and eight primary road extensions around the preserved near-city area. Connected L-shaped street walls, podiums/courtyards and stepped corners fill the wider district up to roughly ±450m. Southern blocks remain lower to protect the operational store view.
- Extended terrain beneath the city to approximately 1km across. Near/distant maps share one world-coordinate colour function: streets, paving parcels, grass, parks and inexpensive distant rooftop footprints. North/south texture direction corrected to match plane UVs. All textures are original procedural work, not satellite/photo assets.
- Added an original window-wall atlas to far building masses, rather than leaving them plain cubes. Roof caps remain untextured.
- Connected front public garden, cross-path and entry path, benches, tree crowns and bus shelters; unified shopfront walkway/awnings. Existing component/interior/traffic/volume-cloud functions retained.
- Added distance haze to blend distant structures/terrain toward the sky, starting beyond the main operating view, rather than fogging the store interior.

Validation: full check passed 64 root suites / 566 tests + 3 web suites/tests before final facade/tree refinements. Final typecheck and 11 targeted tests across 4 suites passed, as did production build and diff checks. Original staged tree unchanged; no push/merge/deployment.

Visual inspection: native Firefox main full-city preset, near-horizontal skyline, and rotated opposite-side full-city view. Store contents remain readable; roads/blocks continue behind and beside the store rather than ending at a plinth edge. This is still a stylized generic city, not photorealistic reconstruction. Repetition, shallow facade relief, synthetic flat far-roof imagery and coarse commercial interiors remain limitations.

Actual unedited captures (shared QA directory, 2026-11-18):
- 02-35-10: connected main full-city view.
- 02-35-36: near-horizontal skyline with layered city behind near buildings.
- 02-36-12: rotated opposite-side overview, verifying continuous roads/blocks on the other side.
- 02-36-51: final fixed full-city preset and runtime counter (recommended main image).

Performance comparison, same 1364×1024 cloud Firefox / candidate layout / economy / low cloud / running traffic / main site preset as prior pass: before continuous fabric 17.2–19.1fps, 45 calls/200k triangles; expanded scene stable samples 14.8 and 16.6fps, 47 calls/218k triangles. Near-horizontal sample 15.3fps, reverse overview 16.9fps. Earlier values during build/test load and camera motion were lower and are not the controlled comparison. These are short frame-callback samples, not a GPU benchmark; expanded scene has a real cost and still does not meet 30fps. No claim of photorealistic realism or final visual acceptance.
