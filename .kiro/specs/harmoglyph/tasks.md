# Implementation Tasks — Harmoglyph

- [x] **Wave 1 — Core Types, Mathematical Foundations & Presets** *(Traces to: Req 1, Req 3)*
  - Define `AppView`, `MathFoundationId`, `SHEET_COLS`, `COLUMN_META`, `SheetEvaluationResult`, `PbtInvariantResult`, `RepoAuditReport`, and `SubmissionPack` in `src/types/chimera.ts`.
  - Implement `src/engine/mathArtTheory.ts` (`harmonic-sine`, `fibonacci`, `golden-ratio`, `pythagorean`) and starter presets in `src/data/presets.ts`.

- [x] **Wave 2 — Formula VM, Web Audio FM Synth, Vector Plotter & 500-Trial PBT** *(Traces to: Req 1, Req 2, Req 3, Req 4, Req 5, Req 7)*
  - Implement recursive-descent `A1:F48` formula evaluator, `#CYCLE!` detection, acoustic clamps, and CSV round-trip in `src/engine/spreadsheetVm.ts`.
  - Implement 2-operator Web Audio FM engine + 16-bit PCM `.wav` encoder coupled to `mathArtTheory` in `src/engine/audioSynth.ts`.
  - Implement 4-mode parametric vector plotter + inverse `geometryToFormulaGrid` compiler in `src/engine/vectorPlotter.ts`.
  - Implement 500-trial seeded PBT suite (5 invariants × 100 trials) in `src/engine/pbtSuite.ts`.

- [x] **Wave 3 — Server Proxy, Score Transcription & Kiro Free-Tier Workspace API** *(Traces to: Req 6, Req 7)*
  - Implement `/api/health`, `/.kiro/specs.json`, `/api/kiroween/specs`, `/api/kiroween/audit`, `/api/kiroween/free-tier-workspace`, and `/api/kiroween/run-hook` in `server.ts`.
  - Implement `/api/kiroween/git-setup`, `/api/kiroween/verify-public`, `/api/kiroween/generate-kiro`, `/api/sheet/transcribe`, `/api/formula/compose`, and `/api/submission/pack`.

- [x] **Wave 4 — Studio, Verify, D3 SpecDependencyGraph & Kiroween Kit UI** *(Traces to: Req 3, Req 5, Req 7)*
  - Build `TopBar.tsx`, `StudioView.tsx`, `VerifyView.tsx`, `SpecDependencyGraph.tsx`, `SubmissionChecklistWidget.tsx`, `KiroFreeTierHub.tsx`, and `KiroweenKitView.tsx`.

- [x] **Wave 5 — Full Kiro Free-Tier Organization (`/.kiro/*`, `/LICENSE`, `/README.md`)** *(Traces to: Req 7)*
  - Configure `always` (`product.md`, `tech-stack.md`, `structure.md`), `fileMatch` (`audio-safety-contract.md`, `math-harmony-contract.md`), and `manual` (`kiroween-submission-guide.md`) steering docs, 3 executable hooks, 2 Kiro Powers, 5-agent crew, and 4 local MCP servers.
