# Supermarket + Agent UI pass (2026-11-18)

- Checkout sample and placed checkouts retain footprint/orientation/IDs; added scanner inset, POS readout, receipt printer and slot, paper, card reader display and bag/handles. All generic teaching props, no real transaction data.
- Reference layout only: subtle department floor material bands in one instanced draw; bounds derived from existing regions, no layout edits.
- Agent: four operational prompts, explicit synthetic/local/offline/time/read-only status, clearer answer/evidence/tool hierarchy, uncertainty preserved, compact followups and labeled composer. IME Enter cannot submit while composing.
- Narrow workspace: stacked scene and Agent; independently scrollable Agent body keeps composer reachable. Desktop resizable split remains intact.
- Native Firefox desktop QA: empty state, priority question, expanded actual synthetic evidence, checkout inspector. Narrow QA recorded separately after final CSS build.
- No push, deployment or merge. Existing staged tree preserved.

## Verification
- `npm run check`: typecheck passed; 66 root test files / 570 tests plus 3 Web files / 5 tests passed.
- Production build passed (8.22s); `git diff --check` clean; staged tree identical to `722ea1a`.
- Firefox actual desktop 1364×1024: 02-55-55 empty Agent, 02-56-34 priority reply/evidence, 02-58-34 checkout sample, 03-01-53 reference-layout overhead and Agent.
- Firefox responsive 768×900: 03.00.50 stacked workspace; 03.01.12 after scrolling Agent body shows entire labeled composer and submit button. Fixed resizable inline flex direction with narrow-only important override after first actual screenshot exposed remaining side-by-side layout.
- Limits: 768px tested, phone-size interactions not certified; reference floor zoning is intentionally subtle, not real-world material surveying. Existing rule responses still retain technical signal IDs for traceability. No claim of live integration or production-grade photorealism.
