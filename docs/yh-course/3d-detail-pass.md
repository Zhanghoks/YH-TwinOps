# Full-store procedural detail pass

This is an original visual skin over `data/store-yh-01.layout.json`, not a measured reconstruction of a Yonghui branch. The layout, fixture IDs, collision envelopes, signals, agent logic, approved GLBs and approval baseline are unchanged.

## What changed

- The operations workbench now starts with **精细模型**. **原始外壳** retains the registry-approved GLB, and **白膜** remains available for geometry inspection. Model presentation is independent of metric overlays.
- Generic product packs and price rails on double-sided gondolas; wooden produce crates with fruit; refrigerated shelves, glass doors and handles; checkout belts, scanners and payment terminals; deli trays and display glass; door frames and service counters.
- Cutaway store envelope, tiled floor and restrained wall fascia add scale without a roof hiding operations. These visual additions do not claim measured architectural dimensions or operational capacity.
- 全店视角 / 俯视布局 / hide-label controls. Selecting any instanced part resolves to its original fixture ID.
- At most 12 geometry/material instance batches for fixtures; bounded detail counts; demand rendering and DPR capped at 1.5. This is a rendering strategy, not a measured FPS claim.
- No downloaded GLB, brand logo, third-party texture, live inventory claim, or second Canvas.

## Run

```sh
npm ci
npm run web
# optional approval API
npm run api
```

Use the workbench at http://localhost:5174, not the older simulator started by the root `dev` script.

## Tests and review

- Pure geometry tests check deterministic generation, no input mutation, positive/finite dimensions, all seven fixture types, and every part staying inside its fixture envelope.
- The full teaching layout is checked against a bounded instance budget.
- UI tests exercise model mode round-trips, repeated camera resets, label toggles and accessible control naming. These use a mocked Scene, not a WebGL renderer.
- Root TypeScript config now excludes `apps/web/**` because that app already has its own DOM-enabled typecheck in the aggregate command. Previously the root Node-only check included browser test setup and failed on DOM globals.

## Remaining acceptance work

The initial sandbox-launched Chromium could not create Unix sockets; the app-managed Chrome also reported WebGL disabled. A later cloud-only acceptance run installed the official Mozilla Firefox binary and used its default sandbox/rendering configuration. No unsafe graphics flags, sandbox disabling, Mac access or production deployment were used.

Verified in the running production build:
- The detailed 3D store actually renders in Firefox. Full-store, top-down and close-up screenshots were captured and delivered.
- Overview/top-view reset, zoom and hiding zone labels work.
- Clicking a detailed shelf highlights it and shows its original fixture ID `F049` and GONDOLA metadata in the operations panel.
- A WebGL initialization failure now remains inside a scene error boundary; operations and alerts remain usable (also covered by a regression test).
- The detail floor and base ground plane were coplanar. The base plane is now lowered in detail mode; the rebuilt close-up was inspected. Thin floor joints still alias at distance and need further visual polish.

Visual judgment: this is an improved procedural low-poly operations model, **not a photorealistic store**. Repeated fixtures/products, overly uniform dark shelf tops, sparse lighting/signage and default label overlap remain visible. GPU/FPS measurements, all fixture picking variants and the full acceptance matrix below are still not verified. Continue review before merging:

1. Inspect full-store and close-up views in detail, original shell and white modes.
2. Click shelf products, produce, checkout and freezer parts; confirm facility details retain original IDs.
3. Change all data overlays; verify unknown/stale labels remain honest.
4. Repeatedly reset/top-view, hide/show labels, and resize the Agent split pane. Confirm exactly one Canvas and usable controls at 1280px and 1440px widths.
5. Run the existing YH approval E2E flow and visually review shadows/glass on the target machine.

This pass is deliberately a draft until that visual acceptance is complete. Fine asset art direction, ceiling services, walk-through camera, measured store capture and real sensor/POS ingestion are not implemented here.

## Reference-driven iteration (cloud Firefox)

The owner supplied a rendered supermarket cockpit reference. This is an art-direction reference, not evidence for its displayed sales, visitor counts, measured area, or brand permission. The runnable teaching layout remains 80 × 50 m and its data remains synthetic.

- Open gondola top spines and narrow freezer headers replace full-depth dark lids. Generic cartons, bottles and jars vary deterministically; produce colors/placement are less uniform. Fixture geometry remains inside the existing envelopes (17,907 parts, seven material/primitive batches).
- A tested, bounded perimeter generator adds a generic red fascia, partial glazing, window frames, exterior planting and rear luminaires. All architectural parts remain outside the operating floor; no new interior collision objects or second Canvas.
- Compact readable wayfinding removes redundant raw IDs. The clipped world-space teaching caption is now a fixed overlay with layout dimensions.
- The first actual Firefox screenshot exposed an obscured rear light strip and an overly thin fascia. A second build moves the wall behind the light strip and enlarges the fascia, then repeats screenshot review. The updated shelf `F086` was clicked, highlighted and linked to its original semantic metadata.
- Validation: full `npm run check` passed 481 root tests and 3 web tests. After the small second-pass architecture adjustment, 16 geometry/architecture tests, web typecheck and web build passed.

Still visibly short of the reference: no photoreal scanned/PBR assets, category-specific merchandising diversity, populated shopping simulation, believable ceiling services, detailed entrance plaza or measured shop capture. The scene remains a simplified procedural model. No invented live KPIs or fake heatmap population were added just to imitate the image. Screenshot review is not an FPS benchmark or full acceptance of every mode/fixture.
