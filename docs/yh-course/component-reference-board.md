# Component reference board: independent design contracts

Source: two user-supplied JPEG references received 2026-11-18: a store overview (1777.jpeg) and an 18-component design board (1776.jpeg). Images remain external reference artifacts; no logos or image pixels are copied into source. Dimensions below are transcribed **design-board targets**, not measured store geometry or permission to resize approved fixtures. Current renderers continue fitting the existing fixture envelopes and preserving business IDs.

Shared language: deep green accents, warm timber inset panels, light stone/tile, matte stainless steel, restrained transparent glass, black recessed plinths. Merchandise is generic decoration, not SKU/inventory data. Tiny labels in the raster reference are not authoritative operational metrics.

| Board | Component | Independent construction / distinguishing silhouette | Target W×D×H mm | Current status / remaining |
|---|---|---|---|---|
|01|Fruit island|Low timber panelled plinth, dark metal frame, six divided crates, varied fruit mound|2800×1600×850|Framed joinery added this round; current envelope retained; mound remains procedural|
|02|Vegetable rack|Three stepped trays, rear upright support, thin metal retainers, lower storage plinth|2400×900×1550|Separate stepped asset still needed; do not silently replace fruit islands|
|03|Seafood counter|Stainless plinth, ice tray, front/end glass, rear service edge|3600×1200×1200|Stainless inset panels added; ice/fish generic; canopy still absent|
|04|Meat service counter|Stainless base, glass frontage, divided red portions, rear prep side|4200×1200×1200|Stainless inset panels added; service canopy/lighting still needed|
|05|Deli counter|Timber warm base, shallow food trays, clear sneeze guard, overhead warm lights|3600×1200×1350|Timber front panels added; canopy and heat-light design pending|
|06|Bakery display|Timber drawers, multi-level glass display, bread forms, warm header|3000×1200×1500|Timber panels and bread scores present; stepped glass tiers pending|
|07|Dairy chiller|Open upright multideck, slim side lights, price rails, bottom grille|3750×900×2000|Open front, rails and side-light strips added; not a functioning refrigeration model|
|08|Frozen cabinet|Upright glass-door row, metal mullions, vertical handles, ventilated plinth|3750×900×2000|Glass doors retained; grille slots added; condensation/lighting pending|
|09|Grocery shelf|Double-sided spine, adjustable metal shelves, mixed cartons/jars, price rails|1200×450×1600|Existing generic dedicated merchandising; realistic modular bay spacing pending|
|10|Beverage gondola|Double-sided shelves, bottle shoulders/necks/caps, low metal plinth|1200×450×1600|Existing bottle-specific construction; reference-like packaging diversity pending|
|11|Household shelf|Taller multideck, large detergent bottles/cartons, pale category panels|1200×450×1800|Existing household-specific forms; distinct real-scale modular silhouette pending|
|12|Service desk|Deep-green fluted front, pale countertop, recessed staff side, two terminals|3600×800×1100|Current desk simplified; flutes/accessible section need separate design|
|13|Entrance gate|Paired stainless posts, glass flaps, top indicator|1800×900×1200 (pair)|Current door skin is not this gate; separate gate component pending|
|14|Checkout lane|Conveyor, scanner, bagging tray, POS, narrow numbered pole|3600×1200×1300|Existing long-axis checkout and capped screen; pole detail pending|
|15|Self-checkout|Compact pedestal, inclined screen, scanner shelf, payment module|1000×700×1600|Not added: no approved business fixture mapping|
|16|Cart bay|Nested basket carts, wheels, handles, two side rails|3200×1200×1100 (bay)|Existing decorative carts; basket wire detail pending|
|17|Cold-room door|Insulated framed slab, raised track, seals and safety bollards|2000×120×2400|Current cold-room block remains simplified; independent door pending|
|18|Receiving dock|Roller door, portal seal, loading platform, corner protection|3000×2500×3600|Current receiving/trucks remain simplified; detailed dock module pending|

Wayfinding is a separate shared subsystem: suspended green aisle signs and digital panels should have distinct frames and original generic content. Do not copy reference brand artwork or assert screen values as real store data.

This checklist is a staged asset plan, not a claim that all 18 components have been implemented or aligned. Keep full-store placement and component craftsmanship as separate acceptance checks. Capture both store-scale composition and close-up silhouette/material views after each implemented round.

## Round 1 verification

`npm run check`: 56 root test files / 536 tests plus 3 web tests passed. Web production build passed with the pre-existing bundle-size warning. `git diff --check` passed. Actual cloud Firefox top and oblique views were inspected after rebuild. The fruit-island dark frame is visible in oblique view; fresh counter fronts distinguish steel from timber. Whole-store overhead view does not expose all fridge front details, so dedicated isolated cabinet inspection is still pending. No claim of all-component visual acceptance. No FPS benchmark. Changes remain local and unpushed for this round.

## Round 2: independent inspection and two silhouettes

The toolbar now has a reversible `组件检视` mode using the same Scene Canvas, not a second canvas. Eight design samples can be switched without changing StoreLayout, fixture IDs, signals, selection or inventory. Reference-board dimensions apply only to isolated samples. Returning to the store restores its layout. The explanatory note explicitly distinguishes samples from the full store.

- Vegetable rack: independent three-step timber trays, metal rear uprights, cantilever brackets, green backing, front retainers/price strips and generic leafy produce. It stays a design-only sample because the existing business layout has no approved vegetable-rack mapping. It is not silently substituted for fruit islands.
- Bakery: a second display level with metal supports, separately modelled scored bread and a price rail, within the current counter envelope. This is reused by the existing bakery skin as well as the isolated 3000×1200×1500 mm sample. Glass, food and wood remain simplified; overhead signage/lighting and accurate curved profiles are still pending.
- First actual single-component screenshot exposed unsupported shelf spans, so brackets/back panels were added before final verification. Bounds testing then caught an overheight back panel and it was reduced to fit the declared envelope, not accepted as a reference-dimension exception.

Independent samples currently cover board 01–08 only. Boards 09–18 remain on the staged checklist above; existing whole-store objects do not count as finished independently designed assets. This is not final all-component acceptance.

Round 2 validation: full `npm run check` passed 57 root files / 538 tests plus 3 Web tests. After the bracket/back-panel/leaf refinement, the 34-test geometry/sample suite, all 3 Web tests (including enter/switch/return without layout mutation), Web TypeScript check and production build passed again. Existing bundle-size warning remains. Firefox actual samples were inspected and saved as `Screenshot 2026-11-18 at 00-35-20 YH-TwinOps 全店运营工作台（合成教学演示）.png` (vegetable) and `Screenshot 2026-11-18 at 00-35-39 YH-TwinOps 全店运营工作台（合成教学演示）.png` (bakery), literal local filenames, not UTC assertions. Returning to the store was visually verified. Timber texture is too repetitive and produce/bread still low-poly; these are identified next-pass gaps, not photorealistic acceptance.

## Round 3: full 18-sample inspection coverage

Boards 09–18 are now individually selectable. 09/10/11 reuse their distinct packaged-food/bottle/household merchandising and 14 reuses the conveyor/scanner/bagging/POS construction at reference sample dimensions. Six new design-only builders add: 12 a green fluted service counter with open staff side and twin terminals; 13 two gate pedestals with transparent swing leaves and indicator strips; 15 a self-check pedestal with scanner, screen, receipt slot and payment module; 16 four nested illustrative wire-basket carts; 17 an insulated sliding cold-door slab with gasket/frame/track/handle; 18 a receiving portal with shutter slats, platform, leveller and bollards. Cart count is illustrative, not an operational count. Gate motion, checkout payment, door opening and dock movement are not simulated.

These assets have independent semantic part IDs and remain bounded to their design envelopes. Each sample remains below 300 parts; only one sample is rendered at a time using shared instanced materials. Inspection camera distance adapts to sample dimensions. No operational asset registration or baseline layout mutation, no additional Canvas, no external asset download. Existing store geometry is unaffected by these six new design-only types.

Coverage is not fidelity acceptance: gates use simple planar glass, cold-door edge geometry is simplified, cart wheels/baskets are low-poly, and the dock lacks rubber seal folds, safety signage and operating animation. Service-counter accessible section and photorealistic materials remain outstanding. No FPS benchmark has been performed.

Round 3 verification: full `npm run check` passed 57 root files / 539 tests plus 3 Web tests before final screenshot-driven fixes. Subsequent shared-material/catalog tests (9 tests), Web typecheck and build passed; final screen-clearance regression brought the catalog suite to 4 passing tests, with another production build passing. `git diff --check` passed. Actual cloud Firefox inspection covered service, gate, self-check, carts, cold door and dock. The initial gate inspection revealed coarse metal stripes (reduced relief/roughness contrast), cart inspection revealed missing lower chassis/caster links (added), and self-check inspection revealed a support intersecting the display (moved behind an opaque display, with clearance regression).

Saved unedited browser screenshots, literal filename times (not asserted UTC): 00-39-14 service (before subtle metal finish refinement), 00-40-32 gate, 00-41-23 dock, 00-43-10 corrected carts, 00-43-38 corrected self-check. Filenames use the shared prefix `Screenshot 2026-11-18 at ` and suffix ` YH-TwinOps 全店运营工作台（合成教学演示）.png`. These are saved in the cloud QA directory, not bundled into the app. The 09–11 and 14 sample selection paths are implemented and bounded by tests but not individually screenshot-accepted in this round. No push, merge or deployment.

## Round 4: remaining shelf/checkout visual inspection

Individually inspected 09 grocery, 10 beverages, 11 household and 14 checkout in real Firefox, and recaptured the final 12 service desk. The compact 1.2 m shelves initially held only three oversized facings per level. Themed bay spacing now targets 0.2 m, retaining the existing maximum bay/part budget; compact sample shelves show six facings instead. The standard checkout POS now uses an opaque display surface instead of tinted glass. Input fixture envelopes and IDs are unchanged. Whole-store bounds/instance-budget tests remain passing.

Final screenshots use the same prefix/suffix stated above: 00-47-07 grocery, 00-47-26 beverages, 00-47-42 household, 00-48-01 checkout, 00-48-23 service desk. All five final images were actually inspected and saved, not image-generated. Remaining differences: generic low-poly packaging and bottle geometry, repetitive abstract labels, simplified counter ergonomics and absent functional screens/animations. Inspection confirms rendering and the stated fixes, not exact image reproduction or formal asset approval.

Final consolidated validation after these fixes: `npm run check` passed 57 root files / 542 tests plus 3 Web tests. Production build passed; pre-existing large-bundle warning remains. `git diff --check` passed. No frame-rate benchmark or full approval E2E rerun. All reference-board work remains local/uncommitted/unpushed; earlier pre-existing staged work is preserved.
