# Beautiful UI · Agent adapters

Adapted under MIT from `slev12397/beautiful-ui` at commit
`44a274e598395ab61e7c96c26fda2758780253b7` (Copyright 2026 Shane Levine).
Full license: `LICENSE` alongside these files.

Upstream source paths:
- `components/site/IceCreamHarness.tsx`: home greeting → tall PromptBar → flat icon/text suggestions; active conversation reading canvas with bottom composer. Adapted in AgentPanel and its CSS. No fake scenario matcher, auto-completion timers, invented recent conversations or simulated tool runs. Compact metadata disclosure preserves real scene and engine information.
- `components/primitives/ContextCards.tsx`: card/header/content/source-chip hierarchy. Replaced gallery defaults with required real evidence props; deterministic immediate display; no source-link arrow for non-link signal IDs.
- `components/primitives/ThinkingState.tsx`: expandable trace/header/vertical rows. Removed STAGES, demo data and synthetic completion timing. Working state is driven only by request lifecycle; rows only from actual returned toolCalls. ui-sdk Collapsible provides keyboard and disclosure semantics.
- `components/primitives/PromptBar.tsx`: tall composer and bottom controls/send layout. Removed demo playback, shader/glimm, fictional models, attachment/dictation/source connectors, tracking and brand logos. Uses existing ui-sdk Field/Textarea/Button and real Agent onSend; keeps IME/Shift+Enter behavior.
- `app/globals.css`: surface/ink/border hierarchy, 6/8/10/14px radius and hairline-shadow scheme translated to ordinary scoped CSS in `../AgentPanel.css` for Vite. Uses project jade accent and higher contrast muted text instead of blue-only accents.

This is a local source adaptation, not the upstream Next.js harness, not a new hosted service. No additional dependencies, paid icon packages, telemetry, external fonts or simulated tool executions were introduced. Lucide icons are already licensed in this repository. Business logic remains in AgentPanel/api/tools; these primitives only render it.
